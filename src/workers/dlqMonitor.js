import { config } from '../config/index.js';
import logger from '../logger/index.js';
import { receiveMessages, deleteMessage } from '../queue/sqsClient.js';
import { ticketRepository } from '../repositories/TicketRepository.js';
import { ticketEventRepository } from '../repositories/TicketEventRepository.js';

async function processDlqMessage(msg, phase) {
  const { taskId } = JSON.parse(msg.Body);
  const log = logger.child({ taskId, phase });

  await ticketRepository.updateStatus(taskId, 'failed');
  await ticketEventRepository.insert({ ticketId: taskId, phase, eventType: 'dlq_routed', payload: { reason: 'max_attempts_exceeded' } });

  log.error({ action: 'final_outcome', outcome: 'failed' }, 'Ticket permanently failed — routed to DLQ');
}

let shuttingDown = false;
process.on('SIGTERM', () => { shuttingDown = true; });
process.on('SIGINT',  () => { shuttingDown = true; });

logger.info('DLQ monitor polling phase1Queue-DLQ and phase2Queue-DLQ...');

while (!shuttingDown) {
  try {
    const [phase1Msgs, phase2Msgs] = await Promise.all([
      receiveMessages(config.PHASE1_DLQ_URL),
      receiveMessages(config.PHASE2_DLQ_URL),
    ]);

    for (const msg of phase1Msgs) {
      await processDlqMessage(msg, 'phase1');
      await deleteMessage(config.PHASE1_DLQ_URL, msg.ReceiptHandle);
    }

    for (const msg of phase2Msgs) {
      await processDlqMessage(msg, 'phase2');
      await deleteMessage(config.PHASE2_DLQ_URL, msg.ReceiptHandle);
    }
  } catch (err) {
    logger.error({ error: err.message }, 'DLQ monitor poll error');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

logger.info('DLQ monitor shut down gracefully');
process.exit(0);
