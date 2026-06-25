interface PeerAudio {
  readonly source: MediaStreamAudioSourceNode;
  readonly gain: GainNode;
  readonly element: HTMLAudioElement;
}

/**
 * Owns the Web Audio graph for remote participants. Each remote stream gets its
 * own GainNode (driven by distance) feeding the shared destination.
 *
 * The muted <audio> element is the well-known Chrome workaround: a remote
 * WebRTC track only produces samples through Web Audio if it is also attached
 * to a media element. We mute that element so the audible output comes solely
 * from the gain-controlled graph.
 */
export class AudioEngine {
  private readonly context: AudioContext;
  private readonly peers = new Map<string, PeerAudio>();

  constructor(context?: AudioContext) {
    this.context = context ?? new AudioContext();
  }

  /** Must be called from a user gesture (AudioContext starts suspended). */
  async resume(): Promise<void> {
    if (this.context.state === 'suspended') await this.context.resume();
  }

  addPeer(peerId: string, stream: MediaStream): void {
    if (this.peers.has(peerId)) return;

    const element = new Audio();
    element.srcObject = stream;
    element.muted = true;
    void element.play().catch(() => {
      /* autoplay may reject; the Web Audio path still pumps the stream */
    });

    const source = this.context.createMediaStreamSource(stream);
    const gain = this.context.createGain();
    gain.gain.value = 0; // start silent; the proximity loop ramps it in
    source.connect(gain).connect(this.context.destination);

    this.peers.set(peerId, { source, gain, element });
  }

  /** Set a peer's volume (0..1) with a short ramp to avoid zipper noise. */
  setGain(peerId: string, value: number): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.05);
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.source.disconnect();
    peer.gain.disconnect();
    peer.element.srcObject = null;
    this.peers.delete(peerId);
  }

  close(): void {
    for (const peerId of [...this.peers.keys()]) this.removePeer(peerId);
    void this.context.close();
  }
}
