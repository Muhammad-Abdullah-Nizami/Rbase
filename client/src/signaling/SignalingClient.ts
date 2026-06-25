import {
  decodeServerMessage,
  parseJson,
  type ClientMessage,
  type ServerMessage,
} from '@proximity/shared';
import { TypedEventEmitter } from '../core/TypedEventEmitter';

export type SignalingState = 'connecting' | 'open' | 'reconnecting' | 'closed';

interface SignalingClientEvents extends Record<string, unknown> {
  statechange: SignalingState;
  message: ServerMessage;
}

export interface SignalingClientOptions {
  readonly url: string;
  readonly baseReconnectDelayMs?: number;
  readonly maxReconnectDelayMs?: number;
}

/**
 * Typed WebSocket transport to the signaling server. Validates every inbound
 * frame through the shared schema and transparently reconnects with capped
 * exponential backoff. Emits `statechange` (so the UI can show connection
 * status) and `message` (decoded, type-safe ServerMessage).
 */
export class SignalingClient extends TypedEventEmitter<SignalingClientEvents> {
  private readonly url: string;
  private readonly baseDelay: number;
  private readonly maxDelay: number;

  private socket: WebSocket | null = null;
  private state: SignalingState = 'closed';
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private shouldReconnect = false;

  constructor(options: SignalingClientOptions) {
    super();
    this.url = options.url;
    this.baseDelay = options.baseReconnectDelayMs ?? 500;
    this.maxDelay = options.maxReconnectDelayMs ?? 10_000;
  }

  get currentState(): SignalingState {
    return this.state;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.open();
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.setState('closed');
  }

  private open(): void {
    this.setState(this.reconnectAttempts === 0 ? 'connecting' : 'reconnecting');
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState('open');
    };

    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'string') return;
      const message = decodeServerMessage(parseJson(event.data));
      if (message) this.emit('message', message);
    };

    socket.onclose = () => {
      this.socket = null;
      if (this.shouldReconnect) this.scheduleReconnect();
      else this.setState('closed');
    };

    // An error is always followed by close; let onclose drive reconnection.
    socket.onerror = () => socket.close();
  }

  private scheduleReconnect(): void {
    this.setState('reconnecting');
    const delay = Math.min(this.maxDelay, this.baseDelay * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => this.open(), delay);
  }

  private setState(state: SignalingState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit('statechange', state);
  }
}
