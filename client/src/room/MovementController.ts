import { rectsOverlap, type Rect, type Size, type Vec2 } from '@proximity/shared';
import type { RoomModel } from './RoomModel';

const MOVE_KEYS: Readonly<Record<string, { readonly dx: number; readonly dy: number }>> = {
  arrowup: { dx: 0, dy: -1 },
  w: { dx: 0, dy: -1 },
  arrowdown: { dx: 0, dy: 1 },
  s: { dx: 0, dy: 1 },
  arrowleft: { dx: -1, dy: 0 },
  a: { dx: -1, dy: 0 },
  arrowright: { dx: 1, dy: 0 },
  d: { dx: 1, dy: 0 },
};

export interface MovementControllerOptions {
  readonly model: RoomModel;
  readonly bounds: Size;
  /** Collision half-extents of the avatar (centre-based). */
  readonly half: { readonly x: number; readonly y: number };
  /** World units per millisecond. */
  readonly speed: number;
  readonly obstacles: readonly Rect[];
  readonly seats: readonly Vec2[];
  readonly seatReach: number;
}

/**
 * Centre-based movement with wall collision and a sit/stand toggle (E). Position
 * is the avatar's centre; sitting is expressed purely as position (snap to a
 * seat), so the renderer derives the sitting pose without any extra state.
 */
export class MovementController {
  private readonly pressed = new Set<string>();

  constructor(private readonly options: MovementControllerOptions) {}

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key === 'e') {
      event.preventDefault();
      this.toggleSit();
      return;
    }
    if (key in MOVE_KEYS) {
      event.preventDefault();
      this.pressed.add(key);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.key.toLowerCase());
  };

  attach(target: Window = window): void {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
  }

  detach(target: Window = window): void {
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
    this.pressed.clear();
  }

  /** Advance one frame by `dt` ms; returns true if the avatar moved. */
  step(dt: number): boolean {
    let dx = 0;
    let dy = 0;
    for (const key of this.pressed) {
      const delta = MOVE_KEYS[key];
      if (delta) {
        dx += delta.dx;
        dy += delta.dy;
      }
    }
    if (dx === 0 && dy === 0) return false;

    const length = Math.hypot(dx, dy);
    const speed = this.options.speed * dt;
    const vx = (dx / length) * speed;
    const vy = (dy / length) * speed;
    const current = this.options.model.self.position;

    // Resolve each axis independently so you slide along walls.
    let x = current.x;
    let y = current.y;
    const tryX = this.clampX(current.x + vx);
    if (!this.collides(tryX, y)) x = tryX;
    const tryY = this.clampY(y + vy);
    if (!this.collides(x, tryY)) y = tryY;

    if (x === current.x && y === current.y) return false;
    this.options.model.setSelfPosition({ x, y });
    return true;
  }

  private toggleSit(): void {
    const { model, seats, seatReach } = this.options;
    const p = model.self.position;
    if (this.nearestSeat(p, 2)) {
      // Already seated → stand by stepping off the seat.
      const ny = this.clampY(p.y + 12);
      if (!this.collides(p.x, ny)) model.setSelfPosition({ x: p.x, y: ny });
      return;
    }
    const seat = this.nearestSeat(p, seatReach);
    if (seat) model.setSelfPosition({ x: seat.x, y: seat.y });
  }

  private nearestSeat(p: Vec2, reach: number): Vec2 | null {
    let best: Vec2 | null = null;
    let bd = reach;
    for (const seat of this.options.seats) {
      const d = Math.hypot(seat.x - p.x, seat.y - p.y);
      if (d < bd) {
        bd = d;
        best = seat;
      }
    }
    return best;
  }

  private collides(x: number, y: number): boolean {
    const { half, obstacles } = this.options;
    const box: Rect = { x: x - half.x, y: y - half.y, width: half.x * 2, height: half.y * 2 };
    for (const obstacle of obstacles) {
      if (rectsOverlap(box, obstacle)) return true;
    }
    return false;
  }

  private clampX(x: number): number {
    return Math.max(this.options.half.x, Math.min(this.options.bounds.width - this.options.half.x, x));
  }

  private clampY(y: number): number {
    return Math.max(this.options.half.y, Math.min(this.options.bounds.height - this.options.half.y, y));
  }
}
