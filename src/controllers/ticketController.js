import { v4 as uuidv4 } from 'uuid';
import { ticketSchema } from '../schemas/ticketSchema.js';
import { ticketRepository } from '../repositories/TicketRepository.js';
import { ticketPhaseRepository } from '../repositories/TicketPhaseRepository.js';
import { ticketEventRepository } from '../repositories/TicketEventRepository.js';
import { sendMessage } from '../queue/sqsClient.js';
import { config } from '../config/index.js';
import logger from '../logger/index.js';

export async function submit(req, res) {
  const parsed = ticketSchema.safeParse(req.body);

  if (!parsed.success) {
    const fields = parsed.error.errors.map((e) => ({
      field:   e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Validation failed', code: 400, fields });
  }

  const { tenantId, subject, body } = parsed.data;
  const taskId = uuidv4();
  const log    = logger.child({ taskId });

  try {
    await ticketRepository.insert({ id: taskId, tenantId, subject, body });
    await ticketEventRepository.insert({ ticketId: taskId, eventType: 'queued', payload: { tenantId } });
    await sendMessage(config.PHASE1_QUEUE_URL, { taskId });

    log.info({ action: 'ticket_queued', tenantId }, 'Ticket accepted and enqueued to Phase 1');

    return res.status(202).json({ ticketId: taskId, status: 'queued' });
  } catch (err) {
    log.error({ error: err.message }, 'Failed to persist ticket');
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error', code: 500 });
  }
}

export async function getStatus(req, res) {
  const { taskId } = req.params;
  const log = logger.child({ taskId });

  try {
    const ticket = await ticketRepository.findById(taskId);

    if (!ticket) {
      return res.status(404).json({ error: 'NOT_FOUND', message: `Ticket ${taskId} not found`, code: 404 });
    }

    const [phases, events] = await Promise.all([
      ticketPhaseRepository.findAllByTicket(taskId),
      ticketEventRepository.findByTicket(taskId, 20),
    ]);

    const phasesMap = {};
    for (const p of phases) {
      phasesMap[p.phase] = {
        status:   p.status,
        attempts: p.attempts,
        output:   p.output ?? null,
      };
    }

    return res.status(200).json({
      ticketId: ticket.id,
      status:   ticket.status,
      phases:   phasesMap,
      events:   events.map(e => ({
        eventType: e.event_type,
        phase:     e.phase,
        payload:   e.payload,
        createdAt: e.created_at,
      })),
    });
  } catch (err) {
    log.error({ error: err.message }, 'Failed to fetch ticket');
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error', code: 500 });
  }
}

export async function replay(req, res) {
  const { taskId } = req.params;
  const log = logger.child({ taskId });

  try {
    const ticket = await ticketRepository.findById(taskId);

    if (!ticket) {
      return res.status(404).json({ error: 'NOT_FOUND', message: `Ticket ${taskId} not found`, code: 404 });
    }

    if (ticket.status !== 'failed') {
      return res.status(409).json({ error: 'CONFLICT', message: 'Only failed tickets can be replayed', code: 409 });
    }

    const phases   = await ticketPhaseRepository.findAllByTicket(taskId);
    const phase1   = phases.find(p => p.phase === 'phase1');

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

    await sendMessage(targetQueue, { taskId });

    log.info({ action: 'ticket_replayed' }, 'Ticket re-enqueued for replay');

    return res.status(202).json({ ticketId: taskId, status: 'queued' });
  } catch (err) {
    log.error({ error: err.message }, 'Failed to replay ticket');
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error', code: 500 });
  }
}
