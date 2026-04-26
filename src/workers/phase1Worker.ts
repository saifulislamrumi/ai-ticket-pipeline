// src/workers/phase1Worker.ts
import { type Message } from '@aws-sdk/client-sqs';
import { config } from '../config/index.ts';
import logger from '../logger/index.ts';
import { sqsClient } from '../queue/sqsClient.ts';
import { ticketRepository } from '../repositories/TicketRepository.ts';
import { ticketPhaseRepository } from '../repositories/TicketPhaseRepository.ts';
import { ticketEventRepository } from '../repositories/TicketEventRepository.ts';
import { calcDelay } from '../utils/backoff.ts';
import { ZodValidationError } from '../utils/ZodValidationError.ts';
import { triageService } from '../services/triageService.ts';
import type { SQSMessageBody } from '../types/index.ts';

class Phase1Worker {
  private shuttingDown = false;

  async start(): Promise<void> {
    process.on('SIGTERM', () => { this.shuttingDown = true; });
    process.on('SIGINT',  () => { this.shuttingDown = true; });

    logger.info('Phase 1 worker polling phase1Queue...');

    while (!this.shuttingDown) {
      try {
        const messages = await sqsClient.receiveMessages(config.PHASE1_QUEUE_URL);
        for (const msg of messages) {
          if (this.shuttingDown) break;
          await this.processMessage(msg);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ error: message }, 'Phase 1 worker poll error');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    logger.info('Phase 1 worker shut down gracefully');
    process.exit(0);
  }

  private async processMessage(msg: Message): Promise<void> {
    const { taskId } = JSON.parse(msg.Body!) as SQSMessageBody;
    const attempt    = parseInt(msg.Attributes?.ApproximateReceiveCount ?? '1', 10);
    const log        = logger.child({ taskId, phase: 'phase1', attempt });

    const ticket = await ticketRepository.findById(taskId);
    if (!ticket) {
      log.error('Ticket not found — discarding message');
      await sqsClient.deleteMessage(config.PHASE1_QUEUE_URL, msg.ReceiptHandle!);
      return;
    }

    await ticketPhaseRepository.insert({ ticketId: taskId, phase: 'phase1' });
    await ticketRepository.updateStatus(taskId, 'processing');
    await ticketPhaseRepository.update(taskId, 'phase1', { status: 'processing', attempts: attempt, startedAt: new Date() });
    await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase1', eventType: 'phase_started', payload: { attempt } });

    log.info({ action: 'phase_started' }, 'Phase 1 started');

    const startedAt = Date.now();

    try {
      const { result, provider } = await triageService.triage(ticket);
      const latencyMs = Date.now() - startedAt;

      await ticketPhaseRepository.update(taskId, 'phase1', {
        status:      'completed',
        output:      result,
        attempts:    attempt,
        completedAt: new Date(),
      });
      await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase1', eventType: 'phase_completed', payload: { attempt, provider, latencyMs } });

      await sqsClient.sendMessage(config.PHASE2_QUEUE_URL, { taskId });
      await sqsClient.deleteMessage(config.PHASE1_QUEUE_URL, msg.ReceiptHandle!);

      log.info({ action: 'phase_completed', latencyMs, provider }, 'Phase 1 completed — Phase 2 enqueued');
    } catch (err) {
      if (err instanceof ZodValidationError) {
        await ticketPhaseRepository.update(taskId, 'phase1', { status: 'failed', attempts: attempt });
        await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase1', eventType: 'phase_failed', payload: { attempt, error: err.message, reason: 'zod_validation' } });
        await ticketRepository.updateStatus(taskId, 'failed');
        await sqsClient.deleteMessage(config.PHASE1_QUEUE_URL, msg.ReceiptHandle!);
        log.error({ action: 'phase_failed', error: err.message }, 'Phase 1 validation failed — not retrying');
      } else {
        const errMessage = err instanceof Error ? err.message : String(err);
        const delayMs    = calcDelay(attempt);
        await ticketPhaseRepository.update(taskId, 'phase1', { status: 'failed', attempts: attempt });
        await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase1', eventType: 'retry_scheduled', payload: { attempt, delayMs, error: errMessage } });
        log.warn({ action: 'retry_scheduled', delayMs, error: errMessage }, 'Phase 1 failed — retrying');
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}

new Phase1Worker().start();
