import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { config } from '../config/index.js';

const clientConfig = {
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
};

if (config.AWS_ENDPOINT_URL) {
  clientConfig.endpoint = config.AWS_ENDPOINT_URL;
}

const sqs = new SQSClient(clientConfig);

export async function sendMessage(queueUrl, payload) {
  await sqs.send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(payload),
  }));
}

export async function receiveMessages(queueUrl, maxMessages = 1) {
  const res = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: config.SQS_WAIT_TIME_SECONDS,
    AttributeNames: ['ApproximateReceiveCount'],
  }));
  return res.Messages ?? [];
}

export async function deleteMessage(queueUrl, receiptHandle) {
  await sqs.send(new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle,
  }));
}
