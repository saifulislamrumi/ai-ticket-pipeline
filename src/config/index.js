import 'dotenv/config';

export const config = {
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',

  DATABASE_URL: process.env.DATABASE_URL,

  AWS_REGION: process.env.AWS_REGION ?? 'us-east-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL,

  PHASE1_QUEUE_URL: process.env.PHASE1_QUEUE_URL,
  PHASE2_QUEUE_URL: process.env.PHASE2_QUEUE_URL,
  PHASE1_DLQ_URL: process.env.PHASE1_DLQ_URL,
  PHASE2_DLQ_URL: process.env.PHASE2_DLQ_URL,

  PORTKEY_API_KEY: process.env.PORTKEY_API_KEY,
  PORTKEY_GROQ_VIRTUAL_KEY: process.env.PORTKEY_GROQ_VIRTUAL_KEY,
  PORTKEY_ANTHROPIC_VIRTUAL_KEY: process.env.PORTKEY_ANTHROPIC_VIRTUAL_KEY,
  PORTKEY_OPENAI_VIRTUAL_KEY: process.env.PORTKEY_OPENAI_VIRTUAL_KEY,
  PORTKEY_GOOGLE_VIRTUAL_KEY: process.env.PORTKEY_GOOGLE_VIRTUAL_KEY,

  MAX_RETRY_ATTEMPTS: parseInt(process.env.MAX_RETRY_ATTEMPTS ?? '3', 10),
  RETRY_BASE_DELAY_MS: parseInt(process.env.RETRY_BASE_DELAY_MS ?? '500', 10),
  RETRY_MAX_DELAY_MS: parseInt(process.env.RETRY_MAX_DELAY_MS ?? '8000', 10),
  RETRY_MAX_JITTER_MS: parseInt(process.env.RETRY_MAX_JITTER_MS ?? '500', 10),
  SQS_VISIBILITY_TIMEOUT: parseInt(process.env.SQS_VISIBILITY_TIMEOUT ?? '60', 10),
  SQS_WAIT_TIME_SECONDS: parseInt(process.env.SQS_WAIT_TIME_SECONDS ?? '20', 10),
};
