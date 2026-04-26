// src/config/index.ts
import 'dotenv/config';

export interface AppConfig {
  PORT:                        number;
  NODE_ENV:                    string;
  LOG_LEVEL:                   string;
  DATABASE_URL:                string;
  AWS_REGION:                  string;
  AWS_ACCESS_KEY_ID:           string;
  AWS_SECRET_ACCESS_KEY:       string;
  AWS_ENDPOINT_URL:            string | undefined;
  PHASE1_QUEUE_URL:            string;
  PHASE2_QUEUE_URL:            string;
  PHASE1_DLQ_URL:              string;
  PHASE2_DLQ_URL:              string;
  PORTKEY_API_KEY:             string;
  PORTKEY_GROQ_VIRTUAL_KEY:    string;
  PORTKEY_ANTHROPIC_VIRTUAL_KEY: string;
  PORTKEY_OPENAI_VIRTUAL_KEY:  string;
  PORTKEY_GOOGLE_VIRTUAL_KEY:  string;
  MAX_RETRY_ATTEMPTS:          number;
  RETRY_BASE_DELAY_MS:         number;
  RETRY_MAX_DELAY_MS:          number;
  RETRY_MAX_JITTER_MS:         number;
  SQS_VISIBILITY_TIMEOUT:      number;
  SQS_WAIT_TIME_SECONDS:       number;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config: AppConfig = {
  PORT:     parseInt(process.env.PORT     ?? '3000', 10),
  NODE_ENV: process.env.NODE_ENV          ?? 'development',
  LOG_LEVEL: process.env.LOG_LEVEL        ?? 'info',

  DATABASE_URL: requireEnv('DATABASE_URL'),

  AWS_REGION:            process.env.AWS_REGION ?? 'us-east-1',
  AWS_ACCESS_KEY_ID:     requireEnv('AWS_ACCESS_KEY_ID'),
  AWS_SECRET_ACCESS_KEY: requireEnv('AWS_SECRET_ACCESS_KEY'),
  AWS_ENDPOINT_URL:      process.env.AWS_ENDPOINT_URL,

  PHASE1_QUEUE_URL: requireEnv('PHASE1_QUEUE_URL'),
  PHASE2_QUEUE_URL: requireEnv('PHASE2_QUEUE_URL'),
  PHASE1_DLQ_URL:   requireEnv('PHASE1_DLQ_URL'),
  PHASE2_DLQ_URL:   requireEnv('PHASE2_DLQ_URL'),

  PORTKEY_API_KEY:               requireEnv('PORTKEY_API_KEY'),
  PORTKEY_GROQ_VIRTUAL_KEY:      requireEnv('PORTKEY_GROQ_VIRTUAL_KEY'),
  PORTKEY_ANTHROPIC_VIRTUAL_KEY: requireEnv('PORTKEY_ANTHROPIC_VIRTUAL_KEY'),
  PORTKEY_OPENAI_VIRTUAL_KEY:    requireEnv('PORTKEY_OPENAI_VIRTUAL_KEY'),
  PORTKEY_GOOGLE_VIRTUAL_KEY:    requireEnv('PORTKEY_GOOGLE_VIRTUAL_KEY'),

  MAX_RETRY_ATTEMPTS:    parseInt(process.env.MAX_RETRY_ATTEMPTS  ?? '3',    10),
  RETRY_BASE_DELAY_MS:   parseInt(process.env.RETRY_BASE_DELAY_MS ?? '500',  10),
  RETRY_MAX_DELAY_MS:    parseInt(process.env.RETRY_MAX_DELAY_MS  ?? '8000', 10),
  RETRY_MAX_JITTER_MS:   parseInt(process.env.RETRY_MAX_JITTER_MS ?? '500',  10),
  SQS_VISIBILITY_TIMEOUT: parseInt(process.env.SQS_VISIBILITY_TIMEOUT ?? '60', 10),
  SQS_WAIT_TIME_SECONDS:  parseInt(process.env.SQS_WAIT_TIME_SECONDS  ?? '20', 10),
};
