// WebRTC mesh + per-peer audio graph.
// Each remote peer gets an RTCPeerConnection and a Web Audio GainNode whose
// value we set every frame from distance. Audio flows peer-to-peer; the
// signaling server only carries the offer/answer/ICE handshake.

export class MeshAudio {
  constructor({ localStream, iceServers, signaling, audioCtx }) {
    this.localStream = localStream;
    this.iceServers = iceServers;
    this.signaling = signaling;
    this.audioCtx = audioCtx;
    this.peers = new Map(); // id -> { pc, gain, audioEl, pendingCandidates, remoteSet }
  }

  _createPeer(id) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    // Send our microphone to this peer.
    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream);
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.signaling.send({ type: 'signal', to: id, data: { candidate: e.candidate } });
      }
    };

    pc.ontrack = (e) => this._attachAudio(id, e.streams[0]);

    const entry = { pc, gain: null, audioEl: null, pendingCandidates: [], remoteSet: false };
    this.peers.set(id, entry);
    return entry;
  }

  _attachAudio(id, stream) {
    const entry = this.peers.get(id);
    if (!entry || entry.gain) return; // already attached

    // Chrome quirk: a remote WebRTC stream stays silent if it's only routed
    // through Web Audio. Attaching it to a (muted) media element keeps the
    // audio pipeline alive so the GainNode actually receives samples.
    const audioEl = new Audio();
    audioEl.srcObject = stream;
    audioEl.muted = true;
    audioEl.play().catch(() => {});

    const source = this.audioCtx.createMediaStreamSource(stream);
    const gain = this.audioCtx.createGain();
    gain.gain.value = 0; // starts silent; distance loop ramps it up
    source.connect(gain).connect(this.audioCtx.destination);

    entry.audioEl = audioEl;
    entry.gain = gain;
  }

  // We initiate the connection to an existing peer (we're the newcomer).
  async callPeer(id) {
    const entry = this._createPeer(id);
    const offer = await entry.pc.createOffer();
    await entry.pc.setLocalDescription(offer);
    this.signaling.send({ type: 'signal', to: id, data: { sdp: entry.pc.localDescription } });
  }

  async onSignal(from, data) {
    let entry = this.peers.get(from);

    if (data.sdp) {
      if (data.sdp.type === 'offer') {
        if (!entry) entry = this._createPeer(from);
        await entry.pc.setRemoteDescription(data.sdp);
        entry.remoteSet = true;
        await this._flush(entry);
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        this.signaling.send({ type: 'signal', to: from, data: { sdp: entry.pc.localDescription } });
      } else if (data.sdp.type === 'answer' && entry) {
        await entry.pc.setRemoteDescription(data.sdp);
        entry.remoteSet = true;
        await this._flush(entry);
      }
    } else if (data.candidate && entry) {
      // Candidates can arrive before the remote description is set — queue them.
      if (entry.remoteSet) {
        try { await entry.pc.addIceCandidate(data.candidate); } catch {}
      } else {
        entry.pendingCandidates.push(data.candidate);
      }
    }
  }

  async _flush(entry) {
    for (const c of entry.pendingCandidates) {
      try { await entry.pc.addIceCandidate(c); } catch {}
    }
    entry.pendingCandidates = [];
  }

  setVolume(id, v) {
    const entry = this.peers.get(id);
    if (entry && entry.gain) entry.gain.gain.value = v;
  }

  setMuted(muted) {
    for (const track of this.localStream.getAudioTracks()) track.enabled = !muted;
  }

  removePeer(id) {
    const entry = this.peers.get(id);
    if (!entry) return;
    try { entry.pc.close(); } catch {}
    if (entry.audioEl) entry.audioEl.srcObject = null;
    this.peers.delete(id);
  }
}
