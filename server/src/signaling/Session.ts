import { decodeClientMessage, parseJson, type ClientMessage } from '@proximity/shared';
import type { Logger } from '../logger.js';
import type { IceServersProvider } from '../turn/IceServersProvider.js';
import type { Peer } from './Peer.js';
import type { Room } from './Room.js';
import type { RoomRegistry } from './RoomRegistry.js';

type JoinMessage = Extract<ClientMessage, { type: 'join' }>;
type MoveMessage = Extract<ClientMessage, { type: 'move' }>;
type SignalMessage = Extract<ClientMessage, { type: 'signal' }>;

/**
 * Owns the lifecycle of one connected peer: validates inbound messages, mutates
 * room state, and fans out the correct notifications. Exactly one Session per
 * connection; all peer-specific mutable state lives here.
 */
export class Session {
  private room: Room | null = null;

  constructor(
    private readonly peer: Peer,
    private readonly rooms: RoomRegistry,
    private readonly iceProvider: IceServersProvider,
    private readonly logger: Logger,
  ) {}

  async handleMessage(raw: string): Promise<void> {
    const message = decodeClientMessage(parseJson(raw));
    if (!message) {
      this.logger.warn('dropped malformed client message');
      return;
    }
    switch (message.type) {
      case 'join':
        await this.onJoin(message);
        return;
      case 'move':
        this.onMove(message);
        return;
      case 'signal':
        this.onSignal(message);
        return;
    }
  }

  handleDisconnect(): void {
    if (!this.room) return;
    const room = this.room;
    this.room = null;
    room.remove(this.peer.id);
    room.broadcast({ type: 'peer-left', id: this.peer.id });
    this.rooms.removeIfEmpty(room.name);
    this.logger.info('peer left', { room: room.name, size: room.size });
  }

  private async onJoin(message: JoinMessage): Promise<void> {
    if (this.room) {
      this.logger.warn('ignoring duplicate join');
      return;
    }

    // Resolve ICE servers *before* touching room state. Everything from the
    // snapshot to the broadcast below then runs synchronously, which makes
    // concurrent joins race-free: a newcomer either shows up in the other's
    // welcome snapshot or arrives via a peer-joined broadcast — never neither.
    const iceServers = await this.iceProvider.getIceServers();

    const room = this.rooms.getOrCreate(message.room);
    this.peer.identify(message.name, message.position);
    const existingPeers = room.snapshotsExcluding(this.peer.id);
    room.add(this.peer);
    this.room = room;

    this.peer.send({
      type: 'welcome',
      self: this.peer.id,
      peers: existingPeers,
      iceServers: [...iceServers],
    });
    room.broadcast({ type: 'peer-joined', peer: this.peer.snapshot() }, { except: this.peer.id });
    this.logger.info('peer joined', { room: room.name, name: this.peer.name, size: room.size });
  }

  private onMove(message: MoveMessage): void {
    if (!this.room) return;
    this.peer.moveTo(message.position);
    this.room.broadcast(
      { type: 'peer-moved', id: this.peer.id, position: message.position, muted: message.muted ?? false },
      { except: this.peer.id },
    );
  }

  private onSignal(message: SignalMessage): void {
    if (!this.room) return;
    const target = this.room.get(message.to);
    if (!target) return; // peer vanished mid-handshake — drop silently
    target.send({ type: 'signal', from: this.peer.id, payload: message.payload });
  }
}
