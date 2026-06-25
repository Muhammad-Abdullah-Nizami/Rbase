import type { IceServer, PeerId, SignalPayload } from '@proximity/shared';
import { PeerSession } from './PeerSession';

export interface MeshControllerDeps {
  readonly localStream: MediaStream;
  readonly sendSignal: (to: PeerId, payload: SignalPayload) => void;
  readonly onRemoteStream: (peerId: PeerId, stream: MediaStream) => void;
  readonly onPeerRemoved: (peerId: PeerId) => void;
  readonly onError?: (peerId: PeerId, error: unknown) => void;
}

/**
 * Owns every peer-to-peer connection in the mesh. Creates a PeerSession per
 * remote peer, assigns politeness deterministically, and routes inbound
 * signaling. A `configure` call (on each welcome) carries our own id and the
 * ICE servers, which lets reconnection rebuild the mesh from scratch.
 */
export class MeshController {
  private readonly sessions = new Map<PeerId, PeerSession>();
  private selfId: PeerId = '';
  private iceServers: IceServer[] = [];

  constructor(private readonly deps: MeshControllerDeps) {}

  configure(selfId: PeerId, iceServers: readonly IceServer[]): void {
    this.selfId = selfId;
    this.iceServers = [...iceServers];
  }

  ensurePeer(peerId: PeerId): void {
    if (this.sessions.has(peerId) || peerId === this.selfId) return;

    const connection = new RTCPeerConnection({ iceServers: this.iceServers as RTCIceServer[] });
    const session = new PeerSession({
      peerId,
      // Deterministic + symmetric: the two peers compute opposite values, so
      // exactly one of each pair is polite.
      polite: this.selfId > peerId,
      connection,
      localStream: this.deps.localStream,
      sendSignal: (payload) => this.deps.sendSignal(peerId, payload),
      onRemoteStream: (stream) => this.deps.onRemoteStream(peerId, stream),
      onError: (error) => this.deps.onError?.(peerId, error),
    });
    this.sessions.set(peerId, session);
  }

  handleSignal(from: PeerId, payload: SignalPayload): void {
    // A signal can be the first thing we hear about a peer (their offer racing
    // ahead of our own ensurePeer); create the session on demand.
    this.ensurePeer(from);
    void this.sessions.get(from)?.handleSignal(payload);
  }

  removePeer(peerId: PeerId): void {
    const session = this.sessions.get(peerId);
    if (!session) return;
    session.close();
    this.sessions.delete(peerId);
    this.deps.onPeerRemoved(peerId);
  }

  reset(): void {
    for (const peerId of [...this.sessions.keys()]) this.removePeer(peerId);
  }
}
