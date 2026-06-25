import { randomUUID } from 'node:crypto';
import type { PeerId } from '@proximity/shared';
import type { Logger } from '../logger.js';
import type { IceServersProvider } from '../turn/IceServersProvider.js';
import type { Connection } from './Connection.js';
import { Peer } from './Peer.js';
import type { RoomRegistry } from './RoomRegistry.js';
import { Session } from './Session.js';

export interface SignalingServiceOptions {
  readonly rooms: RoomRegistry;
  readonly iceProvider: IceServersProvider;
  readonly logger: Logger;
  /** Injectable id generator (tests use a deterministic counter). */
  readonly generateId?: () => PeerId;
}

/**
 * Domain entry point. Wraps each new transport Connection in a Peer + Session
 * and wires the connection's events to it. Holds no per-connection state itself
 * — that lives in each Session.
 */
export class SignalingService {
  private readonly rooms: RoomRegistry;
  private readonly iceProvider: IceServersProvider;
  private readonly logger: Logger;
  private readonly generateId: () => PeerId;

  constructor(options: SignalingServiceOptions) {
    this.rooms = options.rooms;
    this.iceProvider = options.iceProvider;
    this.logger = options.logger;
    this.generateId = options.generateId ?? ((): PeerId => randomUUID());
  }

  accept(connection: Connection): void {
    const id = this.generateId();
    const peer = new Peer(id, connection);
    const session = new Session(peer, this.rooms, this.iceProvider, this.logger.child({ peer: id }));

    connection.onMessage((data) => {
      session.handleMessage(data).catch((error: unknown) => {
        this.logger.error('message handler failed', {
          peer: id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });
    connection.onClose(() => session.handleDisconnect());
  }
}
