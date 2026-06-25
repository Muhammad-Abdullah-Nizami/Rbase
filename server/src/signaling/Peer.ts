import type { PeerId, PeerSnapshot, ServerMessage, Vec2 } from '@proximity/shared';
import type { Connection } from './Connection.js';

/** A connected participant: identity, last-known position, and its channel. */
export class Peer {
  private currentName = 'Anon';
  private currentPosition: Vec2 = { x: 0, y: 0 };

  constructor(
    readonly id: PeerId,
    private readonly connection: Connection,
  ) {}

  get name(): string {
    return this.currentName;
  }

  get position(): Vec2 {
    return this.currentPosition;
  }

  identify(name: string, position: Vec2): void {
    this.currentName = name;
    this.currentPosition = position;
  }

  moveTo(position: Vec2): void {
    this.currentPosition = position;
  }

  snapshot(): PeerSnapshot {
    return { id: this.id, name: this.currentName, position: this.currentPosition };
  }

  send(message: ServerMessage): void {
    this.connection.send(JSON.stringify(message));
  }
}
