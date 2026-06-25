import { distance, type WorldMap } from '@proximity/shared';
import { FALLOFF, SCALE, SEAT_REACH, SPEAKING_THRESHOLD, VIEW } from '../config';
import { roomNameAt } from '../world/map';
import type { RoomModel } from '../room/RoomModel';
import type { AudioEngine } from '../audio/AudioEngine';
import { renderTrainer, type Facing } from './sprites';
import { buildMinimapBase, buildWorldCanvas, type Minimap } from './scene';

const MINI_SCALE = 0.46;
const SELF_COLOR = { shirt: '#4d7d8f', cap: '#d9614f' };
const PEER_PALETTE = [
  { shirt: '#7fa66a', cap: '#6f8aa8' },
  { shirt: '#cc8d86', cap: '#d9a24f' },
  { shirt: '#d9a24f', cap: '#6f8aa8' },
  { shirt: '#6f8aa8', cap: '#cc8d86' },
  { shirt: '#b86f9c', cap: '#7fa66a' },
  { shirt: '#7fa66a', cap: '#cc8d86' },
];

function colorFor(id: string): { shirt: string; cap: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PEER_PALETTE[hash % PEER_PALETTE.length]!;
}

function faceFrom(vx: number, vy: number): Facing {
  if (Math.abs(vy) > Math.abs(vx)) return vy < 0 ? 'up' : 'down';
  return vx < 0 ? 'left' : 'right';
}

interface EntityVis {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  facing: Facing;
  walkT: number;
  moving: boolean;
  sitting: boolean;
  shirt: string;
  cap: string;
}

export interface CanvasRoomViewDeps {
  readonly container: HTMLElement;
  readonly model: RoomModel;
  readonly map: WorldMap;
  readonly audio: AudioEngine;
  readonly isMuted: () => boolean;
}

/**
 * Canvas pixel-art renderer driven by the real RoomModel. Owns the scene canvas
 * and the in-world overlays (name tags, room tab, minimap, participants panel,
 * seat prompt). Application calls render(dt) every frame.
 */
export class CanvasRoomView {
  private readonly model: RoomModel;
  private readonly map: WorldMap;
  private readonly audio: AudioEngine;
  private readonly isMuted: () => boolean;

  private readonly scene: HTMLCanvasElement;
  private readonly mini: Minimap;
  private readonly charBuf: HTMLCanvasElement;
  private readonly charCtx: CanvasRenderingContext2D;

  private readonly sceneCanvas: HTMLCanvasElement;
  private readonly sceneCtx: CanvasRenderingContext2D;
  private readonly overlay: HTMLElement;
  private readonly miniCanvas: HTMLCanvasElement;
  private readonly roomTab: HTMLElement;
  private readonly peopleCount: HTMLElement;
  private readonly participantsList: HTMLElement;
  private readonly seatPrompt: HTMLElement;
  private readonly seatPromptLabel: HTMLElement;
  private readonly tags = new Map<string, HTMLElement>();
  private readonly rows = new Map<string, HTMLElement>();

  private readonly vis = new Map<string, EntityVis>();
  private readonly cam = { x: 0, y: 0 };

  constructor(deps: CanvasRoomViewDeps) {
    this.model = deps.model;
    this.map = deps.map;
    this.audio = deps.audio;
    this.isMuted = deps.isMuted;

    this.scene = buildWorldCanvas(this.map);
    this.mini = buildMinimapBase(this.map, MINI_SCALE);
    this.charBuf = document.createElement('canvas');
    this.charBuf.width = 16;
    this.charBuf.height = 24;
    this.charCtx = ctx2d(this.charBuf);

    const dpW = VIEW.width * SCALE;
    const dpH = VIEW.height * SCALE;

    const root = document.createElement('div');
    root.className = 'room';
    root.style.width = `${dpW}px`;
    root.style.height = `${dpH}px`;

    this.sceneCanvas = document.createElement('canvas');
    this.sceneCanvas.width = VIEW.width;
    this.sceneCanvas.height = VIEW.height;
    this.sceneCanvas.className = 'scene';
    this.sceneCtx = ctx2d(this.sceneCanvas);
    root.append(this.sceneCanvas);

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    root.append(this.overlay);

    // room tab
    this.roomTab = el('div', 'room-tab', this.overlay);
    this.roomTab.innerHTML = '<span class="dot"></span><span class="name"></span>';

    // minimap
    const miniWrap = el('div', 'panel minimap', this.overlay);
    miniWrap.innerHTML = '<div class="panel-head">MAP</div><div class="mini-body"></div>';
    this.miniCanvas = document.createElement('canvas');
    miniWrap.querySelector<HTMLElement>('.mini-body')!.append(this.miniCanvas);

    // participants
    const partPanel = el('div', 'panel participants', this.overlay);
    partPanel.innerHTML =
      '<div class="panel-head">IN THIS SPACE · <span class="count"></span></div><div class="part-list"></div>';
    this.peopleCount = partPanel.querySelector<HTMLElement>('.count')!;
    this.participantsList = partPanel.querySelector<HTMLElement>('.part-list')!;

    // movement hint
    const hint = el('div', 'hint', this.overlay);
    hint.innerHTML = '<span class="key">WASD</span><span>walk · E to sit · get close to talk</span>';

    // seat prompt (positioned each frame)
    this.seatPrompt = el('div', 'seat-prompt', this.overlay);
    this.seatPrompt.innerHTML = '<span class="key">E</span><span class="label">sit down</span>';
    this.seatPromptLabel = this.seatPrompt.querySelector<HTMLElement>('.label')!;

    deps.container.append(root);
  }

  destroy(): void {
    this.overlay.parentElement?.remove();
  }

  render(dt: number): void {
    this.syncEntities(dt);
    this.drawScene();
    this.updateOverlays();
  }

  // --- entity presentation state derived from real positions ---
  private syncEntities(dt: number): void {
    const seen = new Set<string>(['self']);
    this.updateVis('self', this.model.self.position, SELF_COLOR, dt);
    for (const peer of this.model.peers()) {
      seen.add(peer.id);
      this.updateVis(peer.id, peer.position, colorFor(peer.id), dt);
    }
    for (const id of [...this.vis.keys()]) if (!seen.has(id)) this.vis.delete(id);
  }

  private updateVis(id: string, pos: { x: number; y: number }, color: { shirt: string; cap: string }, dt: number): void {
    let v = this.vis.get(id);
    if (!v) {
      v = { x: pos.x, y: pos.y, prevX: pos.x, prevY: pos.y, facing: 'down', walkT: 0, moving: false, sitting: false, shirt: color.shirt, cap: color.cap };
      this.vis.set(id, v);
    }
    const vx = pos.x - v.x;
    const vy = pos.y - v.y;
    v.prevX = v.x;
    v.prevY = v.y;
    v.x = pos.x;
    v.y = pos.y;
    v.moving = Math.abs(vx) > 0.03 || Math.abs(vy) > 0.03;
    if (v.moving) {
      v.facing = faceFrom(vx, vy);
      v.walkT += dt;
    } else {
      v.walkT = 0;
    }
    v.sitting = !v.moving && this.nearestSeat(pos.x, pos.y, 2) !== null;
    if (v.sitting) v.facing = 'up';
    v.shirt = color.shirt;
    v.cap = color.cap;
  }

  private nearestSeat(x: number, y: number, reach: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bd = reach;
    for (const s of this.map.seats) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  // --- canvas ---
  private drawScene(): void {
    const self = this.model.self.position;
    this.cam.x = Math.round(Math.max(0, Math.min(this.map.width - VIEW.width, self.x - VIEW.width / 2)));
    this.cam.y = Math.round(Math.max(0, Math.min(this.map.height - VIEW.height, self.y - VIEW.height / 2)));

    const ctx = this.sceneCtx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.scene, this.cam.x, this.cam.y, VIEW.width, VIEW.height, 0, 0, VIEW.width, VIEW.height);

    // proximity glow under the player
    const psx = self.x - this.cam.x;
    const psy = self.y - this.cam.y;
    ctx.save();
    ctx.lineWidth = 1;
    ([[30, 12], [22, 9], [14, 6]] as const).forEach(([rx, ry], i) => {
      ctx.strokeStyle = `rgba(127,166,106,${0.4 - i * 0.07})`;
      ctx.beginPath();
      ctx.ellipse(psx, psy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.fillStyle = 'rgba(127,166,106,0.08)';
    ctx.beginPath();
    ctx.ellipse(psx, psy, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const ents = [...this.vis.values()].sort((a, b) => a.y - b.y);
    for (const e of ents) this.drawEntity(ctx, e);
  }

  private drawEntity(ctx: CanvasRenderingContext2D, e: EntityVis): void {
    const sx = Math.round(e.x - this.cam.x);
    const sy = Math.round(e.y - this.cam.y);
    if (sx < -16 || sx > VIEW.width + 16 || sy < -28 || sy > VIEW.height + 16) return;
    ctx.fillStyle = 'rgba(58,38,22,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const frame = !e.sitting && e.moving ? [1, 0, 2, 0][Math.floor(e.walkT / 120) % 4]! : 0;
    const bob = !e.sitting && e.moving && frame !== 0 ? -1 : 0;
    renderTrainer(this.charCtx, { facing: e.facing, frame, shirt: e.shirt, cap: e.cap, sitting: e.sitting });
    const tlx = sx - 8;
    const tly = sy - 22 + bob;
    if (e.facing === 'right') {
      ctx.save();
      ctx.translate(tlx + 16, tly);
      ctx.scale(-1, 1);
      ctx.drawImage(this.charBuf, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(this.charBuf, tlx, tly);
    }
  }

  // --- DOM overlays ---
  private updateOverlays(): void {
    const self = this.model.self.position;
    const selfSpeaking = !this.isMuted() && this.audio.getLocalLevel() > SPEAKING_THRESHOLD;

    // name tags
    this.placeTag('self', this.model.self.name, self, true, selfSpeaking);
    for (const peer of this.model.peers()) {
      const audible = distance(self, peer.position) < FALLOFF.silenceRadius;
      const speaking = this.audio.getLevel(peer.id) > SPEAKING_THRESHOLD;
      this.placeTag(peer.id, peer.name, peer.position, audible, speaking);
    }
    for (const [id, tag] of this.tags) {
      if (id !== 'self' && !this.model.hasPeer(id)) {
        tag.remove();
        this.tags.delete(id);
      }
    }

    // room tab
    (this.roomTab.querySelector('.name') as HTMLElement).textContent = roomNameAt(self.x, self.y);

    // seat prompt
    const onSeat = this.vis.get('self')?.sitting ?? false;
    const near = this.nearestSeat(self.x, self.y, SEAT_REACH);
    if (onSeat || near) {
      this.seatPromptLabel.textContent = onSeat ? 'stand up' : 'sit down';
      const sx = Math.round(self.x - this.cam.x);
      const sy = Math.round(self.y - this.cam.y);
      this.seatPrompt.style.left = `${Math.round(sx * SCALE)}px`;
      this.seatPrompt.style.top = `${Math.round((sy + 12) * SCALE)}px`;
      this.seatPrompt.style.opacity = '1';
    } else {
      this.seatPrompt.style.opacity = '0';
    }

    this.updateParticipants(selfSpeaking);
    this.updateMinimap();
  }

  private placeTag(id: string, name: string, pos: { x: number; y: number }, audible: boolean, speaking: boolean): void {
    let tag = this.tags.get(id);
    if (!tag) {
      tag = el('div', 'name-tag', this.overlay);
      tag.innerHTML = '<span class="swatch"></span><span class="bars"><i></i><i></i><i></i></span><span class="who"></span>';
      this.tags.set(id, tag);
    }
    const color = this.vis.get(id)?.shirt ?? '#4d7d8f';
    (tag.querySelector('.swatch') as HTMLElement).style.background = color;
    (tag.querySelector('.who') as HTMLElement).textContent = name;
    tag.classList.toggle('speaking', speaking);
    const sx = Math.round(pos.x - this.cam.x);
    const sy = Math.round(pos.y - this.cam.y);
    if (sx < -10 || sx > VIEW.width + 10 || sy < -20 || sy > VIEW.height + 10) {
      tag.style.opacity = '0';
      return;
    }
    tag.style.left = `${Math.round(sx * SCALE)}px`;
    tag.style.top = `${Math.round((sy - 28) * SCALE)}px`;
    tag.style.opacity = audible ? '1' : '0.4';
  }

  private updateParticipants(selfSpeaking: boolean): void {
    const entries: Array<{ id: string; name: string; color: string; speaking: boolean }> = [
      { id: 'self', name: `${this.model.self.name} (you)`, color: SELF_COLOR.shirt, speaking: selfSpeaking },
    ];
    for (const peer of this.model.peers()) {
      entries.push({
        id: peer.id,
        name: peer.name,
        color: colorFor(peer.id).shirt,
        speaking: this.audio.getLevel(peer.id) > SPEAKING_THRESHOLD,
      });
    }
    this.peopleCount.textContent = String(entries.length);

    const seen = new Set<string>();
    for (const entry of entries) {
      seen.add(entry.id);
      let row = this.rows.get(entry.id);
      if (!row) {
        row = el('div', 'part-row', this.participantsList);
        row.innerHTML = '<span class="swatch"></span><span class="who"></span><span class="bars"><i></i><i></i><i></i></span>';
        this.rows.set(entry.id, row);
      }
      (row.querySelector('.swatch') as HTMLElement).style.background = entry.color;
      (row.querySelector('.who') as HTMLElement).textContent = entry.name;
      row.classList.toggle('speaking', entry.speaking);
    }
    for (const [id, row] of this.rows) {
      if (!seen.has(id)) {
        row.remove();
        this.rows.delete(id);
      }
    }
  }

  private updateMinimap(): void {
    const mini = this.miniCanvas;
    if (mini.width !== this.mini.width) {
      mini.width = this.mini.width;
      mini.height = this.mini.height;
    }
    const ctx = ctx2d(mini);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mini.canvas, 0, 0);
    const dot = (x: number, y: number, col: string): void => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x * MINI_SCALE) - 1, Math.round(y * MINI_SCALE) - 1, 3, 3);
    };
    for (const peer of this.model.peers()) dot(peer.position.x, peer.position.y, colorFor(peer.id).shirt);
    const self = this.model.self.position;
    dot(self.x, self.y, SELF_COLOR.shirt);
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(Math.round(self.x * MINI_SCALE) - 2, Math.round(self.y * MINI_SCALE) - 2, 5, 1);
    ctx.strokeStyle = 'rgba(255,250,235,0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(this.cam.x * MINI_SCALE) + 0.5,
      Math.round(this.cam.y * MINI_SCALE) + 0.5,
      Math.round(VIEW.width * MINI_SCALE),
      Math.round(VIEW.height * MINI_SCALE),
    );
  }
}

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

function el(tag: string, className: string, parent: HTMLElement): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  parent.append(node);
  return node;
}
