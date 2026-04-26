// src/workers/dlqMonitor.ts
import { type Message } from '@aws-sdk/client-sqs';
import { config } from '../config/index.js';
import logger from '../logger/index.js';
import { sqsClient } from '../queue/sqsClient.js';
import { ticketRepository } from '../repositories/TicketRepository.js';
import { ticketEventRepository } from '../repositories/TicketEventRepository.js';
import type { Phase, SQSMessageBody } from '../types/index.js';

class DLQMonitor {
  private shuttingDown = false;

  async start(): Promise<void> {
    process.on('SIGTERM', () => { this.shuttingDown = true; });
    process.on('SIGINT',  () => { this.shuttingDown = true; });

    logger.info('DLQ monitor polling phase1Queue-DLQ and phase2Queue-DLQ...');

    while (!this.shuttingDown) {
      try {
        const [phase1Msgs, phase2Msgs] = await Promise.all([
          sqsClient.receiveMessages(config.PHASE1_DLQ_URL),
          sqsClient.receiveMessages(config.PHASE2_DLQ_URL),
        ]);

        for (const msg of phase1Msgs) {
          await this.processDlqMessage(msg, 'phase1');
          await sqsClient.deleteMessage(config.PHASE1_DLQ_URL, msg.ReceiptHandle!);
        }

        for (const msg of phase2Msgs) {
          await this.processDlqMessage(msg, 'phase2');
          await sqsClient.deleteMessage(config.PHASE2_DLQ_URL, msg.ReceiptHandle!);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ error: message }, 'DLQ monitor poll error');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    logger.info('DLQ monitor shut down gracefully');
    process.exit(0);
  }

  private async processDlqMessage(msg: Message, phase: Phase): Promise<void> {
    const { taskId } = JSON.parse(msg.Body!) as SQSMessageBody;
    const log = logger.child({ taskId, phase });

    await ticketRepository.updateStatus(taskId, 'failed');
    await ticketEventRepository.insert({ ticketId: taskId, phase, eventType: 'dlq_routed', payload: { reason: 'max_attempts_exceeded' } });

    log.error({ action: 'final_outcome', outcome: 'failed' }, 'Ticket permanently failed — routed to DLQ');
  }
}

new DLQMonitor().start();
