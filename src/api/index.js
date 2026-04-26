import express from 'express';
import { createServer } from 'http';
import { config } from '../config/index.js';
import logger from '../logger/index.js';
import healthRouter from '../routes/health.js';
import ticketsRouter from '../routes/tickets.js';

const app = express();
app.use(express.json());

app.use('/', healthRouter);
app.use('/api/tickets', ticketsRouter);

const httpServer = createServer(app);

httpServer.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, `Server running on port ${config.PORT}`);
});

export { httpServer, app };
