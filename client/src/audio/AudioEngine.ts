interface PeerAudio {
  readonly source: MediaStreamAudioSourceNode;
  readonly gain: GainNode;
  readonly analyser: AnalyserNode;
  readonly buffer: Uint8Array<ArrayBuffer>;
  readonly element: HTMLAudioElement;
}

const FFT_SIZE = 512;

/**
 * Owns the Web Audio graph for remote participants. Each remote stream gets a
 * GainNode (driven by distance) feeding the destination, plus an AnalyserNode
 * tap so we can tell when someone is speaking. The local mic is also analysed
 * (but never routed to the destination — no self-echo).
 *
 * The muted <audio> element is the Chrome workaround: a remote WebRTC track only
 * produces samples through Web Audio if it's also attached to a media element.
 */
export class AudioEngine {
  private readonly context: AudioContext;
  private readonly peers = new Map<string, PeerAudio>();
  private localAnalyser: AnalyserNode | null = null;
  private localBuffer: Uint8Array<ArrayBuffer> = new Uint8Array(FFT_SIZE);
  private localSource: MediaStreamAudioSourceNode | null = null;

  constructor(context?: AudioContext) {
    this.context = context ?? new AudioContext();
  }

  /** Must be called from a user gesture (AudioContext starts suspended). */
  async resume(): Promise<void> {
    if (this.context.state === 'suspended') await this.context.resume();
  }

  /** Analyse the local mic so we can show our own speaking indicator. */
  monitorLocal(stream: MediaStream): void {
    this.localSource = this.context.createMediaStreamSource(stream);
    this.localAnalyser = this.context.createAnalyser();
    this.localAnalyser.fftSize = FFT_SIZE;
    this.localBuffer = new Uint8Array(this.localAnalyser.fftSize);
    this.localSource.connect(this.localAnalyser); // analysis only, no destination
  }

  addPeer(peerId: string, stream: MediaStream): void {
    if (this.peers.has(peerId)) return;

    const element = new Audio();
    element.srcObject = stream;
    element.muted = true;
    void element.play().catch(() => {});

    const source = this.context.createMediaStreamSource(stream);
    const gain = this.context.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.context.destination);

    const analyser = this.context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    source.connect(analyser);

    this.peers.set(peerId, { source, gain, analyser, buffer: new Uint8Array(analyser.fftSize), element });
  }

  /** Set a peer's volume (0..1) with a short ramp to avoid zipper noise. */
  setGain(peerId: string, value: number): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.05);
  }

  /** Normalized RMS level (0..1) of a remote peer; 0 if unknown. */
  getLevel(peerId: string): number {
    const peer = this.peers.get(peerId);
    if (!peer) return 0;
    return rms(peer.analyser, peer.buffer);
  }

  /** Normalized RMS level (0..1) of the local mic; 0 if not monitored. */
  getLocalLevel(): number {
    if (!this.localAnalyser) return 0;
    return rms(this.localAnalyser, this.localBuffer);
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.source.disconnect();
    peer.gain.disconnect();
    peer.analyser.disconnect();
    peer.element.srcObject = null;
    this.peers.delete(peerId);
  }

  close(): void {
    for (const peerId of [...this.peers.keys()]) this.removePeer(peerId);
    this.localSource?.disconnect();
    void this.context.close();
  }
}

function rms(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const x = ((buffer[i] ?? 128) - 128) / 128;
    sum += x * x;
  }
  return Math.sqrt(sum / buffer.length);
}
