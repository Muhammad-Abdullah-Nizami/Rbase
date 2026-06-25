import type { PeerId, PeerSnapshot, ServerMessage } from '@proximity/shared';
import type { Peer } from './Peer.js';

export interface BroadcastOptions {
  /** Skip this peer (typically the message's originator). */
  readonly except?: PeerId;
}

/** A set of peers sharing a space, with fan-out messaging. */
export class Room {
  private readonly peers = new Map<PeerId, Peer>();

  constructor(readonly name: string) {}

  get size(): number {
    return this.peers.size;
  }

  get isEmpty(): boolean {
    return this.peers.size === 0;
  }

  has(id: PeerId): boolean {
    return this.peers.has(id);
  }

  get(id: PeerId): Peer | undefined {
    return this.peers.get(id);
  }

  add(peer: Peer): void {
    this.peers.set(peer.id, peer);
  }

  remove(id: PeerId): void {
    this.peers.delete(id);
  }

  snapshotsExcluding(id: PeerId): PeerSnapshot[] {
    const snapshots: PeerSnapshot[] = [];
    for (const peer of this.peers.values()) {
      if (peer.id !== id) snapshots.push(peer.snapshot());
    }
    return snapshots;
  }

  broadcast(message: ServerMessage, options: BroadcastOptions = {}): void {
    for (const peer of this.peers.values()) {
      if (peer.id === options.except) continue;
      peer.send(message);
    }
  }
}
