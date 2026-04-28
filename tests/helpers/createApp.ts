import express from 'express';
import healthRouter  from '../../src/routes/health.ts';
import ticketsRouter from '../../src/routes/tickets.ts';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/', healthRouter);
  app.use('/api/tickets', ticketsRouter);
  return app;
}
