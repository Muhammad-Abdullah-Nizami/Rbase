import type { PeerId, Vec2 } from '@proximity/shared';
import { TypedEventEmitter } from '../core/TypedEventEmitter';

export interface LocalParticipant {
  name: string;
  position: Vec2;
}

export interface RemoteParticipant {
  readonly id: PeerId;
  name: string;
  position: Vec2;
  muted: boolean;
}

interface RoomModelEvents extends Record<string, unknown> {
  'self-moved': Vec2;
  'peer-added': RemoteParticipant;
  'peer-removed': PeerId;
  'peer-moved': RemoteParticipant;
}

/**
 * Authoritative client-side state of who is in the room and where. Pure data +
 * change events — no DOM, no networking — which makes it the natural place to
 * unit-test the spatial bookkeeping.
 */
export class RoomModel extends TypedEventEmitter<RoomModelEvents> {
  readonly self: LocalParticipant;
  private readonly remote = new Map<PeerId, RemoteParticipant>();

  constructor(name: string, position: Vec2) {
    super();
    this.self = { name, position };
  }

  peers(): Iterable<RemoteParticipant> {
    return this.remote.values();
  }

  hasPeer(id: PeerId): boolean {
    return this.remote.has(id);
  }

  setSelfPosition(position: Vec2): void {
    this.self.position = position;
    this.emit('self-moved', position);
  }

  addPeer(participant: { id: PeerId; name: string; position: Vec2 }): void {
    if (this.remote.has(participant.id)) return;
    const remote: RemoteParticipant = { ...participant, muted: false };
    this.remote.set(remote.id, remote);
    this.emit('peer-added', remote);
  }

  removePeer(id: PeerId): void {
    if (!this.remote.delete(id)) return;
    this.emit('peer-removed', id);
  }

  setPeerPosition(id: PeerId, position: Vec2, muted = false): void {
    const peer = this.remote.get(id);
    if (!peer) return;
    peer.position = position;
    peer.muted = muted;
    this.emit('peer-moved', peer);
  }

  clear(): void {
    for (const id of [...this.remote.keys()]) this.removePeer(id);
  }
}
