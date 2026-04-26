// scripts/createQueues.ts
import {
  SQSClient,
  CreateQueueCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import { config } from '../src/config/index.js';

const sqs = new SQSClient({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId:     config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
  endpoint: config.AWS_ENDPOINT_URL,
});

async function createQueue(name: string, attributes: Record<string, string> = {}): Promise<string> {
  const res = await sqs.send(new CreateQueueCommand({
    QueueName: name,
    Attributes: {
      VisibilityTimeout: String(config.SQS_VISIBILITY_TIMEOUT),
      ...attributes,
    },
  }));
  if (!res.QueueUrl) throw new Error(`Failed to create queue: ${name}`);
  console.log(`✅ Created queue: ${name} → ${res.QueueUrl}`);
  return res.QueueUrl;
}

async function getQueueArn(queueUrl: string): Promise<string> {
  const res = await sqs.send(new GetQueueAttributesCommand({
    QueueUrl:       queueUrl,
    AttributeNames: ['QueueArn'],
  }));
  const arn = res.Attributes?.QueueArn;
  if (!arn) throw new Error(`Failed to get ARN for queue: ${queueUrl}`);
  return arn;
}

// Create DLQs first (needed for redrive policy ARN)
const phase1DlqUrl = await createQueue('phase1Queue-DLQ');
const phase2DlqUrl = await createQueue('phase2Queue-DLQ');

const phase1DlqArn = await getQueueArn(phase1DlqUrl);
const phase2DlqArn = await getQueueArn(phase2DlqUrl);

// Create main queues with redrive policies pointing to their DLQs
await createQueue('phase1Queue', {
  RedrivePolicy: JSON.stringify({ deadLetterTargetArn: phase1DlqArn, maxReceiveCount: '3' }),
});

await createQueue('phase2Queue', {
  RedrivePolicy: JSON.stringify({ deadLetterTargetArn: phase2DlqArn, maxReceiveCount: '3' }),
});

console.log('\n✅ All 4 queues provisioned successfully.');
