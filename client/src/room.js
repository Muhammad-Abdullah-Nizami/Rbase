// The visual room: renders avatars, handles local movement, and computes
// per-peer volume from distance. Pure UI + geometry — no networking here.

export const ROOM_W = 800;
export const ROOM_H = 600;
const AVATAR = 32;
const SPEED = 4; // px per frame

// Distance -> volume falloff (in px).
const FULL_RADIUS = 90; // full volume within this
const MAX_RADIUS = 340; // silent beyond this

export class Room {
  constructor(rootEl) {
    this.el = rootEl;
    this.el.style.width = ROOM_W + 'px';
    this.el.style.height = ROOM_H + 'px';

    this.me = { x: ROOM_W / 2, y: ROOM_H / 2, name: 'you' };
    this.peers = new Map(); // id -> { x, y, name, el }
    this.keys = new Set();

    this.localEl = this._makeAvatar('you', true);
    this._place(this.localEl, this.me.x, this.me.y);
    this._bindKeys();
  }

  _makeAvatar(name, isMe) {
    const el = document.createElement('div');
    el.className = 'avatar' + (isMe ? ' me' : '');
    el.innerHTML = '<div class="dot"></div><div class="label"></div>';
    el.querySelector('.label').textContent = name;
    this.el.appendChild(el);
    return el;
  }

  setMe(name) {
    this.me.name = name;
    this.localEl.querySelector('.label').textContent = name;
  }

  addPeer(id, name, x, y) {
    if (this.peers.has(id)) return;
    const el = this._makeAvatar(name, false);
    this.peers.set(id, { x, y, name, el });
    this._place(el, x, y);
  }

  removePeer(id) {
    const p = this.peers.get(id);
    if (p) { p.el.remove(); this.peers.delete(id); }
  }

  setPeerPos(id, x, y) {
    const p = this.peers.get(id);
    if (p) { p.x = x; p.y = y; this._place(p.el, x, y); }
  }

  _place(el, x, y) {
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  // Advance the local avatar one frame. Returns true if it moved.
  step() {
    let dx = 0, dy = 0;
    if (this.keys.has('arrowup') || this.keys.has('w')) dy -= SPEED;
    if (this.keys.has('arrowdown') || this.keys.has('s')) dy += SPEED;
    if (this.keys.has('arrowleft') || this.keys.has('a')) dx -= SPEED;
    if (this.keys.has('arrowright') || this.keys.has('d')) dx += SPEED;
    if (dx === 0 && dy === 0) return false;

    this.me.x = Math.max(0, Math.min(ROOM_W - AVATAR, this.me.x + dx));
    this.me.y = Math.max(0, Math.min(ROOM_H - AVATAR, this.me.y + dy));
    this._place(this.localEl, this.me.x, this.me.y);
    return true;
  }

  // Volume (0..1) for a peer based on its distance from me.
  volumeFor(id) {
    const p = this.peers.get(id);
    if (!p) return 0;
    const dist = Math.hypot(p.x - this.me.x, p.y - this.me.y);
    if (dist <= FULL_RADIUS) return 1;
    if (dist >= MAX_RADIUS) return 0;
    return 1 - (dist - FULL_RADIUS) / (MAX_RADIUS - FULL_RADIUS);
  }
}
