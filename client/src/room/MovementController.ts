import { clampToBounds, type Bounds } from '@proximity/shared';
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
}

/** Translates held movement keys into per-tick motion of the local avatar. */
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

    const { model, bounds, avatarSize, speed } = this.options;
    const current = model.self.position;
    const next = clampToBounds(
      { x: current.x + dx * speed, y: current.y + dy * speed },
      bounds,
      avatarSize,
    );
    if (next.x === current.x && next.y === current.y) return false;
    model.setSelfPosition(next);
    return true;
  }
}
