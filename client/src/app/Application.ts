import type { ServerMessage, Vec2 } from '@proximity/shared';
import {
  AVATAR_HALF,
  FALLOFF,
  MOVE_SPEED,
  OCCLUSION_PER_WALL,
  POSITION_SYNC_INTERVAL_MS,
  ROOM_NAME,
  SEAT_REACH,
} from '../config';
import { defaultMap } from '../world/map';
import type { AudioEngine } from '../audio/AudioEngine';
import { ProximityController } from '../audio/ProximityController';
import { MeshController } from '../rtc/MeshController';
import { RoomModel } from '../room/RoomModel';
import { MovementController } from '../room/MovementController';
import { CanvasRoomView } from '../render/CanvasRoomView';
import { ControlBar } from '../ui/ControlBar';
import type { SignalingClient, SignalingState } from '../signaling/SignalingClient';

export interface ApplicationDeps {
  readonly stage: HTMLElement;
  readonly name: string;
  readonly localStream: MediaStream;
  readonly audioEngine: AudioEngine;
  readonly signaling: SignalingClient;
  readonly onLeave: () => void;
}

const STATUS: Record<SignalingState, string> = {
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  open: 'Connected',
  closed: 'Offline',
};

/** Post-join composition root: wires model, canvas view, movement, mesh, audio. */
export class Application {
  private readonly model: RoomModel;
  private readonly view: CanvasRoomView;
  private readonly movement: MovementController;
  private readonly proximity: ProximityController;
  private readonly mesh: MeshController;
  private readonly controlBar: ControlBar;

  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private lastSyncAt = 0;
  private lastSync: Vec2 = { x: 0, y: 0 };
  private muted = false;

  constructor(private readonly deps: ApplicationDeps) {
    this.model = new RoomModel(deps.name, { ...defaultMap.spawn });

    this.view = new CanvasRoomView({
      container: deps.stage,
      model: this.model,
      map: defaultMap,
      audio: deps.audioEngine,
      isMuted: () => this.muted,
    });

    this.controlBar = new ControlBar();
    this.controlBar.mount(deps.stage);
    this.controlBar.onToggleMute((muted) => this.setMuted(muted));
    this.controlBar.onLeave(() => this.deps.onLeave());

    this.movement = new MovementController({
      model: this.model,
      bounds: { width: defaultMap.width, height: defaultMap.height },
      half: AVATAR_HALF,
      speed: MOVE_SPEED,
      // Walls AND furniture (props) block movement; only walls block audio.
      obstacles: [...defaultMap.walls, ...defaultMap.props],
      seats: defaultMap.seats,
      seatReach: SEAT_REACH,
    });
    this.proximity = new ProximityController(
      this.model,
      deps.audioEngine,
      FALLOFF,
      defaultMap.walls,
      OCCLUSION_PER_WALL,
    );
    this.mesh = new MeshController({
      localStream: deps.localStream,
      sendSignal: (to, payload) => deps.signaling.send({ type: 'signal', to, payload }),
      onRemoteStream: (peerId, stream) => deps.audioEngine.addPeer(peerId, stream),
      onPeerRemoved: (peerId) => deps.audioEngine.removePeer(peerId),
    });

    deps.audioEngine.monitorLocal(deps.localStream);
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.lastSync = { ...this.model.self.position };
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
    this.controlBar.destroy();
    this.view.destroy();
    for (const track of this.deps.localStream.getTracks()) track.stop();
    this.deps.audioEngine.close();
  }

  private readonly loop = (time: number): void => {
    if (!this.running) return;
    const dt = Math.min(50, time - this.lastTime);
    this.lastTime = time;

    this.movement.step(dt);
    this.syncPosition(time);
    this.proximity.update();
    this.view.render(dt);

    this.rafId = requestAnimationFrame(this.loop);
  };

  private syncPosition(time: number): void {
    const pos = this.model.self.position;
    if (pos.x === this.lastSync.x && pos.y === this.lastSync.y) return;
    if (time - this.lastSyncAt < POSITION_SYNC_INTERVAL_MS) return;
    this.deps.signaling.send({ type: 'move', position: pos, muted: this.muted });
    this.lastSync = { ...pos };
    this.lastSyncAt = time;
  }

  private onStateChange(state: SignalingState): void {
    this.controlBar.setStatus(STATUS[state]);
    if (state === 'open') {
      this.deps.signaling.send({
        type: 'join',
        room: ROOM_NAME,
        name: this.deps.name,
        position: this.model.self.position,
      });
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
        break;
      case 'peer-joined':
        this.model.addPeer(message.peer);
        this.mesh.ensurePeer(message.peer.id);
        break;
      case 'peer-left':
        this.model.removePeer(message.id);
        this.mesh.removePeer(message.id);
        break;
      case 'peer-moved':
        this.model.setPeerPosition(message.id, message.position, message.muted ?? false);
        break;
      case 'signal':
        this.mesh.handleSignal(message.from, message.payload);
        break;
    }
  }

  private setMuted(muted: boolean): void {
    this.muted = muted;
    for (const track of this.deps.localStream.getAudioTracks()) track.enabled = !muted;
    // Broadcast immediately so peers see the mute even if we're standing still.
    this.deps.signaling.send({ type: 'move', position: this.model.self.position, muted });
  }
}
