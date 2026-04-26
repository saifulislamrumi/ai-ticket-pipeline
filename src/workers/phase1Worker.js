import { config } from '../config/index.js';
import logger from '../logger/index.js';
import { receiveMessages, sendMessage, deleteMessage } from '../queue/sqsClient.js';
import { ticketRepository } from '../repositories/TicketRepository.js';
import { ticketPhaseRepository } from '../repositories/TicketPhaseRepository.js';
import { ticketEventRepository } from '../repositories/TicketEventRepository.js';
import { calcDelay } from '../utils/backoff.js';
import { ZodValidationError } from '../utils/ZodValidationError.js';
import { triage } from '../services/triageService.js';

async function processMessage(msg) {
  const { taskId } = JSON.parse(msg.Body);
  const attempt    = parseInt(msg.Attributes?.ApproximateReceiveCount ?? '1', 10);
  const log        = logger.child({ taskId, phase: 'phase1', attempt });

  const ticket = await ticketRepository.findById(taskId);
  if (!ticket) {
    log.error('Ticket not found — discarding message');
    await deleteMessage(config.PHASE1_QUEUE_URL, msg.ReceiptHandle);
    return;
  }

  await ticketPhaseRepository.insert({ ticketId: taskId, phase: 'phase1' });
  await ticketRepository.updateStatus(taskId, 'processing');
  await ticketPhaseRepository.update(taskId, 'phase1', { status: 'processing', attempts: attempt, startedAt: new Date() });
  await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase1', eventType: 'phase_started', payload: { attempt } });

  log.info({ action: 'phase_started' }, 'Phase 1 started');

  const startedAt = Date.now();

  try {
    const { result, provider } = await triage(ticket);
    const latencyMs = Date.now() - startedAt;

    await ticketPhaseRepository.update(taskId, 'phase1', {
      status:      'completed',
      output:      result,
      attempts:    attempt,
      completedAt: new Date(),
    });
    await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase1', eventType: 'phase_completed', payload: { attempt, provider, latencyMs } });

    await sendMessage(config.PHASE2_QUEUE_URL, { taskId });
    await deleteMessage(config.PHASE1_QUEUE_URL, msg.ReceiptHandle);

    log.info({ action: 'phase_completed', latencyMs, provider }, 'Phase 1 completed — Phase 2 enqueued');
  } catch (err) {
    if (err instanceof ZodValidationError) {
      await ticketPhaseRepository.update(taskId, 'phase1', { status: 'failed', attempts: attempt });
      await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase1', eventType: 'phase_failed', payload: { attempt, error: err.message, reason: 'zod_validation' } });
      await ticketRepository.updateStatus(taskId, 'failed');
      await deleteMessage(config.PHASE1_QUEUE_URL, msg.ReceiptHandle);
      log.error({ action: 'phase_failed', error: err.message }, 'Phase 1 validation failed — not retrying');
    } else {
      const delayMs = calcDelay(attempt);
      await ticketPhaseRepository.update(taskId, 'phase1', { status: 'failed', attempts: attempt });
      await ticketEventRepository.insert({ ticketId: taskId, phase: 'phase1', eventType: 'retry_scheduled', payload: { attempt, delayMs, error: err.message } });
      log.warn({ action: 'retry_scheduled', delayMs, error: err.message }, 'Phase 1 failed — retrying');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

let shuttingDown = false;
process.on('SIGTERM', () => { shuttingDown = true; });
process.on('SIGINT',  () => { shuttingDown = true; });

logger.info('Phase 1 worker polling phase1Queue...');

while (!shuttingDown) {
  try {
    const messages = await receiveMessages(config.PHASE1_QUEUE_URL);
    for (const msg of messages) {
      if (shuttingDown) break;
      await processMessage(msg);
    }
  } catch (err) {
    logger.error({ error: err.message }, 'Phase 1 worker poll error');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

logger.info('Phase 1 worker shut down gracefully');
process.exit(0);
