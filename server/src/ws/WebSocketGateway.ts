import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Logger } from '../logger.js';
import type { SignalingService } from '../signaling/SignalingService.js';
import { WebSocketConnection } from './WebSocketConnection.js';

export interface WebSocketGatewayOptions {
  readonly server: Server;
  readonly service: SignalingService;
  readonly logger: Logger;
  readonly heartbeatIntervalMs?: number;
}

/**
 * Hosts the WebSocket server on the shared HTTP server, adapts each socket to a
 * Connection, and runs a ping/pong heartbeat that terminates dead sockets so
 * half-open connections can't linger as ghost peers.
 */
export class WebSocketGateway {
  private readonly wss: WebSocketServer;
  private readonly logger: Logger;
  private readonly liveness = new WeakMap<WebSocket, boolean>();
  private readonly heartbeat: NodeJS.Timeout;

  constructor(options: WebSocketGatewayOptions) {
    this.logger = options.logger;
    this.wss = new WebSocketServer({ server: options.server });

    this.wss.on('connection', (socket) => {
      this.liveness.set(socket, true);
      socket.on('pong', () => this.liveness.set(socket, true));
      socket.on('error', (error) => this.logger.warn('socket error', { error: error.message }));
      options.service.accept(new WebSocketConnection(socket));
    });

    this.heartbeat = setInterval(() => this.pingAll(), options.heartbeatIntervalMs ?? 30_000);
    this.heartbeat.unref();
  }

  private pingAll(): void {
    for (const socket of this.wss.clients) {
      if (this.liveness.get(socket) === false) {
        socket.terminate();
        continue;
      }
      this.liveness.set(socket, false);
      socket.ping();
    }
  }

  close(): Promise<void> {
    clearInterval(this.heartbeat);
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }
}
