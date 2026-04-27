// src/controllers/ticketController.ts
import { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ticketSchema } from '../schemas/ticketSchema.ts';
import { ticketRepository } from '../repositories/TicketRepository.ts';
import { ticketPhaseRepository } from '../repositories/TicketPhaseRepository.ts';
import { ticketEventRepository } from '../repositories/TicketEventRepository.ts';
import { sqsClient } from '../queue/sqsClient.ts';
import { config } from '../config/index.ts';
import logger from '../logger/index.ts';
import type { PhaseView, EventView, StatusResponse } from '../types/index.ts';

type ParamRequest = Request<{ taskId: string }>;

export async function list(_req: Request, res: Response): Promise<void> {
  try {
    const tickets = await ticketRepository.findAll();
    res.status(200).json({
      tickets: tickets.map((t) => ({
        id:         t.id,
        status:     t.status,
        created_at: t.created_at,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ error: message }, 'Failed to list tickets');
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error', code: 500 });
  }
}

export async function submit(req: Request, res: Response): Promise<void> {
  const parsed = ticketSchema.safeParse(req.body);

  if (!parsed.success) {
    const fields = parsed.error.errors.map((e) => ({
      field:   e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Validation failed', code: 400, fields });
    return;
  }

  const { tenantId, subject, body } = parsed.data;
  const taskId = uuidv4();
  const log    = logger.child({ taskId });

  try {
    await ticketRepository.insert({ id: taskId, tenantId, subject, body });
    await ticketEventRepository.insert({ ticketId: taskId, eventType: 'queued', payload: { tenantId } });
    await sqsClient.sendMessage(config.PHASE1_QUEUE_URL, { taskId });

    log.info({ action: 'ticket_queued', tenantId }, 'Ticket accepted and enqueued to Phase 1');

    res.status(202).json({ ticketId: taskId, status: 'queued' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ error: message }, 'Failed to persist ticket');
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error', code: 500 });
  }
}

export async function getStatus(req: ParamRequest, res: Response): Promise<void> {
  const { taskId } = req.params;
  const log = logger.child({ taskId });

  try {
    const ticket = await ticketRepository.findById(taskId);

    if (!ticket) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Ticket ${taskId} not found`, code: 404 });
      return;
    }

    const [phases, events] = await Promise.all([
      ticketPhaseRepository.findAllByTicket(taskId),
      ticketEventRepository.findByTicket(taskId, 20),
    ]);

    const phaseLabel: Record<string, string> = { phase1: 'triage', phase2: 'draft' };
    const phasesMap: Partial<Record<string, PhaseView>> = {};
    for (const p of phases) {
      const label = phaseLabel[p.phase] ?? p.phase;
      phasesMap[label] = {
        status:   p.status,
        attempts: p.attempts,
        output:   p.output ?? null,
      };
    }

    const response: StatusResponse = {
      ticketId:  ticket.id,
      status:    ticket.status,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      phases:    phasesMap,
      events:    events.map((e): EventView => ({
        eventType: e.event_type,
        phase:     e.phase,
        payload:   e.payload,
        createdAt: e.created_at,
      })),
    };

    res.status(200).json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ error: message }, 'Failed to fetch ticket');
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error', code: 500 });
  }
}

export async function replay(req: ParamRequest, res: Response): Promise<void> {
  const { taskId } = req.params;
  const log = logger.child({ taskId });

  try {
    const ticket = await ticketRepository.findById(taskId);

    if (!ticket) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Ticket ${taskId} not found`, code: 404 });
      return;
    }

    if (ticket.status !== 'failed') {
      res.status(409).json({ error: 'CONFLICT', message: 'Only failed tickets can be replayed', code: 409 });
      return;
    }

    const phases = await ticketPhaseRepository.findAllByTicket(taskId);
    const phase1 = phases.find(p => p.phase === 'phase1');

    // Reset failed phases to pending, keep completed phases intact
    for (const p of phases) {
      if (p.status === 'failed') {
        await ticketPhaseRepository.update(taskId, p.phase, { status: 'pending' });
      }
    }

    await ticketRepository.updateStatus(taskId, 'queued');
    await ticketEventRepository.insert({ ticketId: taskId, eventType: 'queued', payload: { replay: true } });

    // Enqueue to the right queue based on which phase needs re-running
    const targetQueue = (phase1?.status === 'completed')
      ? config.PHASE2_QUEUE_URL
      : config.PHASE1_QUEUE_URL;

    await sqsClient.sendMessage(targetQueue, { taskId });

    log.info({ action: 'ticket_replayed' }, 'Ticket re-enqueued for replay');

    res.status(202).json({ ticketId: taskId, status: 'queued' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ error: message }, 'Failed to replay ticket');
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error', code: 500 });
  }
}
