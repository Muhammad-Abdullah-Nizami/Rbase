import type { RawData, WebSocket } from 'ws';
import type { Connection } from '../signaling/Connection.js';

/** Adapts a `ws` socket to the transport-agnostic Connection interface. */
export class WebSocketConnection implements Connection {
  constructor(private readonly socket: WebSocket) {}

  send(data: string): void {
    if (this.socket.readyState === this.socket.OPEN) this.socket.send(data);
  }

  close(): void {
    this.socket.close();
  }

  onMessage(handler: (data: string) => void): void {
    this.socket.on('message', (raw: RawData) => handler(raw.toString()));
  }

  onClose(handler: () => void): void {
    this.socket.on('close', handler);
  }
}
