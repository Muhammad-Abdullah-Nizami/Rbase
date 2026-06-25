import type { ServerMessage } from '@proximity/shared';
import {
  AVATAR_SIZE,
  FALLOFF,
  MOVE_SPEED,
  POSITION_SYNC_INTERVAL_MS,
  ROOM_BOUNDS,
  ROOM_NAME,
} from '../config';
import type { AudioEngine } from '../audio/AudioEngine';
import { ProximityController } from '../audio/ProximityController';
import { MeshController } from '../rtc/MeshController';
import { RoomModel } from '../room/RoomModel';
import { RoomView } from '../room/RoomView';
import { MovementController } from '../room/MovementController';
import { ControlBar } from '../ui/ControlBar';
import type { SignalingClient, SignalingState } from '../signaling/SignalingClient';

export interface ApplicationDeps {
  readonly root: HTMLElement;
  readonly name: string;
  readonly localStream: MediaStream;
  readonly audioEngine: AudioEngine;
  readonly signaling: SignalingClient;
}

/**
 * Post-join composition root. Owns the room model + view, the input/movement
 * loop, the WebRTC mesh, and the proximity→gain bridge, and translates inbound
 * server messages into mutations on those collaborators.
 */
export class Application {
  private readonly model: RoomModel;
  private readonly view: RoomView;
  private readonly movement: MovementController;
  private readonly proximity: ProximityController;
  private readonly mesh: MeshController;
  private readonly controlBar: ControlBar;

  private running = false;
  private rafId = 0;
  private lastSyncAt = 0;

  constructor(private readonly deps: ApplicationDeps) {
    this.model = new RoomModel(deps.name, {
      x: ROOM_BOUNDS.width / 2,
      y: ROOM_BOUNDS.height / 2,
    });

    const roomElement = document.createElement('div');
    deps.root.append(roomElement);
    this.view = new RoomView(roomElement, this.model, ROOM_BOUNDS);

    this.controlBar = new ControlBar();
    this.controlBar.mount(deps.root);
    this.controlBar.onToggleMute((muted) => this.setMuted(muted));

    this.movement = new MovementController({
      model: this.model,
      bounds: ROOM_BOUNDS,
      avatarSize: AVATAR_SIZE,
      speed: MOVE_SPEED,
    });
    this.proximity = new ProximityController(this.model, deps.audioEngine, FALLOFF);

    this.mesh = new MeshController({
      localStream: deps.localStream,
      sendSignal: (to, payload) => deps.signaling.send({ type: 'signal', to, payload }),
      onRemoteStream: (peerId, stream) => deps.audioEngine.addPeer(peerId, stream),
      onPeerRemoved: (peerId) => deps.audioEngine.removePeer(peerId),
    });
  }

  start(): void {
    this.running = true;
    this.movement.attach();
    this.deps.signaling.on('statechange', (state) => this.onStateChange(state));
    this.deps.signaling.on('message', (message) => this.onMessage(message));
    this.deps.signaling.connect();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.movement.detach();
    this.mesh.reset();
    this.deps.signaling.close();
    this.view.destroy();
  }

  private readonly loop = (time: number): void => {
    if (!this.running) return;
    const moved = this.movement.step();
    if (moved && time - this.lastSyncAt >= POSITION_SYNC_INTERVAL_MS) {
      this.deps.signaling.send({ type: 'move', position: this.model.self.position });
      this.lastSyncAt = time;
    }
    this.proximity.update();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private onStateChange(state: SignalingState): void {
    switch (state) {
      case 'open':
        // (Re)join on every (re)connect — the server replies with a fresh welcome.
        this.deps.signaling.send({
          type: 'join',
          room: ROOM_NAME,
          name: this.deps.name,
          position: this.model.self.position,
        });
        break;
      case 'connecting':
        this.controlBar.setStatus('connecting…');
        break;
      case 'reconnecting':
        this.controlBar.setStatus('reconnecting…');
        break;
      case 'closed':
        this.controlBar.setStatus('disconnected');
        break;
    }
  }

  private onMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        this.mesh.configure(message.self, message.iceServers);
        this.mesh.reset();
        this.model.clear();
        for (const peer of message.peers) {
          this.model.addPeer(peer);
          this.mesh.ensurePeer(peer.id);
        }
        this.updatePresence();
        break;
      case 'peer-joined':
        this.model.addPeer(message.peer);
        this.mesh.ensurePeer(message.peer.id);
        this.updatePresence();
        break;
      case 'peer-left':
        this.model.removePeer(message.id);
        this.mesh.removePeer(message.id);
        this.updatePresence();
        break;
      case 'peer-moved':
        this.model.setPeerPosition(message.id, message.position);
        break;
      case 'signal':
        this.mesh.handleSignal(message.from, message.payload);
        break;
    }
  }

  private updatePresence(): void {
    const count = [...this.model.peers()].length;
    this.controlBar.setStatus(
      count === 0 ? 'connected — you are alone' : `connected — ${count} ${count === 1 ? 'other' : 'others'}`,
    );
  }

  private setMuted(muted: boolean): void {
    for (const track of this.deps.localStream.getAudioTracks()) {
      track.enabled = !muted;
    }
  }
}
