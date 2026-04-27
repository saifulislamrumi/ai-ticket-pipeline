// src/api/index.ts
import express from 'express';
import { createServer } from 'http';
import { config } from '../config/index.ts';
import logger from '../logger/index.ts';
import healthRouter from '../routes/health.ts';
import ticketsRouter from '../routes/tickets.ts';
import { socketServer } from '../socket/socketServer.ts';

const app = express();
app.use(express.json());

app.use('/', healthRouter);
app.use('/api/tickets', ticketsRouter);

const httpServer = createServer(app);
socketServer.init(httpServer);

httpServer.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, `Server running on port ${config.PORT}`);
});

export { httpServer, app };
