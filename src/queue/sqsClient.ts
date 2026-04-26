// src/queue/sqsClient.ts
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  type Message,
  type QueueAttributeName,
} from '@aws-sdk/client-sqs';
import { config } from '../config/index.js';

class SQSQueueClient {
  private readonly client: SQSClient;

  constructor() {
    this.client = new SQSClient({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId:     config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
      ...(config.AWS_ENDPOINT_URL ? { endpoint: config.AWS_ENDPOINT_URL } : {}),
    });
  }

  async sendMessage(queueUrl: string, payload: Record<string, unknown>): Promise<void> {
    await this.client.send(new SendMessageCommand({
      QueueUrl:    queueUrl,
      MessageBody: JSON.stringify(payload),
    }));
  }

  async receiveMessages(queueUrl: string, maxMessages = 1): Promise<Message[]> {
    const res = await this.client.send(new ReceiveMessageCommand({
      QueueUrl:           queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds:    config.SQS_WAIT_TIME_SECONDS,
      AttributeNames:     ['ApproximateReceiveCount' as QueueAttributeName],
    }));
    return res.Messages ?? [];
  }

  async deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
    await this.client.send(new DeleteMessageCommand({
      QueueUrl:      queueUrl,
      ReceiptHandle: receiptHandle,
    }));
  }
}

export const sqsClient = new SQSQueueClient();
