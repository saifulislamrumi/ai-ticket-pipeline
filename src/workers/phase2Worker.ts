// src/workers/phase2Worker.ts
import { type Message } from '@aws-sdk/client-sqs';
import { config } from '../config/index.js';
import logger from '../logger/index.js';
import { sqsClient } from '../queue/sqsClient.js';
import { ticketRepository } from '../repositories/TicketRepository.js';
import { ticketPhaseRepository } from '../repositories/TicketPhaseRepository.js';
import { ticketEventRepository } from '../repositories/TicketEventRepository.js';
import { calcDelay } from '../utils/backoff.js';
import { ZodValidationError } from '../utils/ZodValidationError.js';
import { generateResolution } from '../services/resolutionService.js';
import type { SQSMessageBody } from '../types/index.js';

class Phase2Worker {
  private shuttingDown = false;

  async start(): Promise<void> {
    process.on('SIGTERM', () => { this.shuttingDown = true; });
    process.on('SIGINT',  () => { this.shuttingDown = true; });

    logger.info('Phase 2 worker polling phase2Queue...');

    while (!this.shuttingDown) {
      try {
        const messages = await sqsClient.receiveMessages(config.PHASE2_QUEUE_URL);
        for (const msg of messages) {
          if (this.shuttingDown) break;
          await this.processMessage(msg);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ error: message }, 'Phase 2 worker poll error');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    logger.info('Phase 2 worker shut down gracefully');
    process.exit(0);
  }

  private async processMessage(msg: Message): Promise<void> {
    const { taskId } = JSON.parse(msg.Body!) as SQSMessageBody;
    const attempt    = parseInt(msg.Attributes?.ApproximateReceiveCount ?? '1', 10);
    const log        = logger.child({ taskId, phase: 'phase2', attempt });

    const ticket = await ticketRepository.findById(taskId);
    if (!ticket) {
      log.error('Ticket not found — discarding message');
      await sqsClient.deleteMessage(config.PHASE2_QUEUE_URL, msg.ReceiptHandle!);
      return;
    }

    // Always fetch Phase 1 result from DB — never re-run Phase 1 AI
    const phase1Row = await ticketPhaseRepository.findByTicket(taskId, 'phase1');
    if (!phase1Row || phase1Row.status !== 'completed') {
      log.error({ phase1Status: phase1Row?.status }, 'Phase 1 not complete — discarding');
      await sqsClient.deleteMessage(config.PHASE2_QUEUE_URL, msg.ReceiptHandle!);
      return;
    }
    const phase1Result = phase1Row.output;

    await ticketPhaseRepository.insert({ ticketId: taskId, phase: 'phase2' });
    await ticketPhaseRepository.update(taskId, 'phase2', { status: 'processing', attempts: attempt, startedAt: new Date() });
    await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase2', eventType: 'phase_started', payload: { attempt } });

    log.info({ action: 'phase_started' }, 'Phase 2 started');

    const startedAt = Date.now();

    try {
      const { result, provider } = await generateResolution(ticket, phase1Result);
      const latencyMs = Date.now() - startedAt;

      await ticketPhaseRepository.update(taskId, 'phase2', {
        status:      'completed',
        output:      result,
        attempts:    attempt,
        completedAt: new Date(),
      });
      await ticketRepository.updateStatus(taskId, 'completed');

      await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase2', eventType: 'phase_completed', payload: { attempt, provider, latencyMs } });
      await ticketEventRepository.insert({ ticketId: taskId, eventType: 'completed', payload: { latencyMs } });

      await sqsClient.deleteMessage(config.PHASE2_QUEUE_URL, msg.ReceiptHandle!);

      log.info({ action: 'final_outcome', outcome: 'completed', latencyMs, provider }, 'Ticket completed');
    } catch (err) {
      if (err instanceof ZodValidationError) {
        await ticketPhaseRepository.update(taskId, 'phase2', { status: 'failed', attempts: attempt });
        await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase2', eventType: 'phase_failed', payload: { attempt, error: err.message, reason: 'zod_validation' } });
        await ticketRepository.updateStatus(taskId, 'failed');
        await sqsClient.deleteMessage(config.PHASE2_QUEUE_URL, msg.ReceiptHandle!);
        log.error({ action: 'phase_failed', error: err.message }, 'Phase 2 validation failed — not retrying');
      } else {
        const errMessage = err instanceof Error ? err.message : String(err);
        const delayMs    = calcDelay(attempt);
        await ticketPhaseRepository.update(taskId, 'phase2', { status: 'failed', attempts: attempt });
        await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase2', eventType: 'retry_scheduled', payload: { attempt, delayMs, error: errMessage } });
        log.warn({ action: 'retry_scheduled', delayMs, error: errMessage }, 'Phase 2 failed — retrying');
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}

new Phase2Worker().start();
