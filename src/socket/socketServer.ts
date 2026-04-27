// src/socket/socketServer.ts
import { Server }                        from 'socket.io';
import { type Server as HttpServer }     from 'http';
import logger                            from '../logger/index.ts';
import { SOCKET_EVENTS, type SocketEvent } from '../types/index.ts';

class SocketServer {
  private io: Server | undefined;

  init(httpServer: HttpServer): void {
    if (this.io) return;

    this.io = new Server(httpServer, { cors: { origin: '*' } });

    this.io.on('connection', (socket) => {
      socket.on(SOCKET_EVENTS.JOIN_TICKET, (taskId: string) => {
        socket.join(`ticket:${taskId}`);
        logger.info({ taskId }, 'Client joined ticket room');
      });
    });

    logger.info('Socket.io initialized');
  }

  emitToTicket(taskId: string, event: SocketEvent, data: Record<string, unknown> = {}): void {
    if (!this.io) return;

    const payload = { taskId, ...data, timestamp: new Date().toISOString() };
    this.io.to(`ticket:${taskId}`).emit(event, payload);

    logger.info({ taskId, event }, 'Socket event emitted');
  }
}

export const socketServer = new SocketServer();
