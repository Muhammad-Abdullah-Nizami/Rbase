import type { SignalPayload } from '@proximity/shared';

export interface PeerSessionOptions {
  readonly peerId: string;
  /**
   * Politeness for the "perfect negotiation" pattern. Exactly one side of each
   * pair must be polite; the impolite side wins glare. Assigned deterministically
   * by the mesh from the two peer ids.
   */
  readonly polite: boolean;
  readonly connection: RTCPeerConnection;
  readonly localStream: MediaStream;
  readonly sendSignal: (payload: SignalPayload) => void;
  readonly onRemoteStream: (stream: MediaStream) => void;
  readonly onError?: (error: unknown) => void;
}

/**
 * Wraps a single RTCPeerConnection using the canonical "perfect negotiation"
 * algorithm, which makes the offer/answer exchange robust to glare (both sides
 * negotiating at once) without any "who goes first" coordination beyond the
 * polite/impolite role.
 *
 * See https://w3c.github.io/webrtc-pc/#perfect-negotiation-example
 */
export class PeerSession {
  private makingOffer = false;
  private ignoreOffer = false;

  constructor(private readonly options: PeerSessionOptions) {
    const pc = options.connection;

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        this.sendDescription();
      } catch (error) {
        options.onError?.(error);
      } finally {
        this.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) options.sendSignal({ kind: 'candidate', candidate: candidate.toJSON() });
    };

    pc.ontrack = ({ streams }) => {
      const [stream] = streams;
      if (stream) options.onRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      // A transient ICE failure: try an ICE restart rather than dropping audio.
      if (pc.connectionState === 'failed') pc.restartIce();
    };

    // Adding our mic triggers onnegotiationneeded -> the first offer.
    for (const track of options.localStream.getTracks()) {
      pc.addTrack(track, options.localStream);
    }
  }

  async handleSignal(payload: SignalPayload): Promise<void> {
    const pc = this.options.connection;
    try {
      if (payload.kind === 'description') {
        const description = payload.description as RTCSessionDescriptionInit;
        const offerCollision =
          description.type === 'offer' && (this.makingOffer || pc.signalingState !== 'stable');
        this.ignoreOffer = !this.options.polite && offerCollision;
        if (this.ignoreOffer) return;

        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          this.sendDescription();
        }
      } else {
        try {
          await pc.addIceCandidate(payload.candidate as RTCIceCandidateInit);
        } catch (error) {
          if (!this.ignoreOffer) throw error; // candidates for an ignored offer are expected to fail
        }
      }
    } catch (error) {
      this.options.onError?.(error);
    }
  }

  close(): void {
    const pc = this.options.connection;
    pc.onnegotiationneeded = null;
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
  }

  private sendDescription(): void {
    const description = this.options.connection.localDescription;
    if (!description) return;
    this.options.sendSignal({
      kind: 'description',
      description: { type: description.type, sdp: description.sdp },
    });
  }
}
