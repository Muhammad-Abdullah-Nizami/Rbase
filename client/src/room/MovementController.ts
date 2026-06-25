import { clampToBounds, rectsOverlap, type Bounds, type Rect, type Vec2 } from '@proximity/shared';
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
  readonly bounds: Bounds;
  readonly avatarSize: number;
  readonly speed: number;
  /** Solid rectangles that block movement (walls AND props like the table). */
  readonly obstacles: readonly Rect[];
}

/**
 * Translates held movement keys into per-tick motion of the local avatar,
 * clamped to the world and blocked by obstacles (walls and solid props). When a
 * diagonal/colliding move is rejected, it retries each axis alone so you slide
 * along an obstacle instead of sticking.
 */
export class MovementController {
  private readonly pressed = new Set<string>();

  constructor(private readonly options: MovementControllerOptions) {}

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
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

  /** Advance one frame; returns true if the avatar actually moved. */
  step(): boolean {
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

    const { bounds, avatarSize, speed, obstacles } = this.options;
    const current = this.options.model.self.position;
    const stepX = dx * speed;
    const stepY = dy * speed;

    const tryMove = (x: number, y: number): Vec2 | null => {
      const clamped = clampToBounds({ x, y }, bounds, avatarSize);
      const box: Rect = { x: clamped.x, y: clamped.y, width: avatarSize, height: avatarSize };
      for (const obstacle of obstacles) {
        if (rectsOverlap(box, obstacle)) return null;
      }
      return clamped;
    };

    const next =
      tryMove(current.x + stepX, current.y + stepY) ?? // full move
      tryMove(current.x + stepX, current.y) ?? // slide along a vertical wall
      tryMove(current.x, current.y + stepY); // slide along a horizontal wall

    if (!next || (next.x === current.x && next.y === current.y)) return false;
    this.options.model.setSelfPosition(next);
    return true;
  }
}
