// src/logger/index.ts
import pino from 'pino';
import { config } from '../config/index.ts';

const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export default logger;
