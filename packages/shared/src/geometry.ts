/**
 * Pure geometry used by the proximity audio model. No side effects, no DOM —
 * trivially unit-testable, and shared so client and (potential future) server
 * logic agree on exactly how distance maps to volume.
 */

import type { Vec2 } from './protocol.js';

export interface FalloffConfig {
  /** Distance (px) within which a peer is at full volume (gain 1.0). */
  readonly fullVolumeRadius: number;
  /** Distance (px) at or beyond which a peer is silent (gain 0.0). */
  readonly silenceRadius: number;
}

export interface Bounds {
  readonly width: number;
  readonly height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Map a distance to a gain in [0, 1] with a linear falloff between
 * `fullVolumeRadius` and `silenceRadius`. Defensive against degenerate configs
 * (negative or inverted radii) so a bad constant can never produce NaN/Infinity.
 */
export function volumeForDistance(d: number, cfg: FalloffConfig): number {
  const full = Math.max(0, cfg.fullVolumeRadius);
  const silence = Math.max(full, cfg.silenceRadius);
  if (d <= full) return 1;
  if (d >= silence || silence === full) return 0;
  return 1 - (d - full) / (silence - full);
}

export function volumeBetween(a: Vec2, b: Vec2, cfg: FalloffConfig): number {
  return volumeForDistance(distance(a, b), cfg);
}

/** Clamp a position so an avatar of edge length `size` stays fully inside `bounds`. */
export function clampToBounds(p: Vec2, bounds: Bounds, size: number): Vec2 {
  return {
    x: clamp(p.x, 0, Math.max(0, bounds.width - size)),
    y: clamp(p.y, 0, Math.max(0, bounds.height - size)),
  };
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Axis-aligned bounding-box overlap. Touching edges do NOT count as overlap. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Does the segment a→b intersect (or lie within) the axis-aligned rectangle?
 *
 * Liang–Barsky clipping: clip the segment's parameter range [0,1] against the
 * rect's four slabs; a non-empty remaining range means they intersect. Robust
 * to vertical/horizontal segments (the `p === 0` parallel case) and to either
 * endpoint being inside the rect.
 */
export function segmentIntersectsRect(a: Vec2, b: Vec2, rect: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const xMin = rect.x;
  const xMax = rect.x + rect.width;
  const yMin = rect.y;
  const yMax = rect.y + rect.height;

  const p = [-dx, dx, -dy, dy];
  const q = [a.x - xMin, xMax - a.x, a.y - yMin, yMax - a.y];

  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i += 1) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (pi === 0) {
      if (qi < 0) return false; // parallel to this slab and entirely outside it
    } else {
      const r = qi / pi;
      if (pi < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

/**
 * Multiplicative occlusion factor in [0, 1] for the line between `a` and `b`:
 * each wall the segment crosses multiplies the result by `attenuationPerWall`
 * (0 = walls fully block, 1 = walls don't block at all). Because the test is a
 * straight line, a doorway gap between two wall rectangles lets sound through.
 */
export function occlusionBetween(
  a: Vec2,
  b: Vec2,
  walls: readonly Rect[],
  attenuationPerWall: number,
): number {
  const atten = clamp(attenuationPerWall, 0, 1);
  let factor = 1;
  for (const wall of walls) {
    if (segmentIntersectsRect(a, b, wall)) {
      factor *= atten;
      if (factor === 0) break;
    }
  }
  return factor;
}

/**
 * Translation for a follow-camera world layer so that the avatar whose
 * top-left is `selfTopLeft` (edge length `avatarSize`) sits centered in
 * `viewport`, clamped so the world never reveals empty space past its edges.
 */
export function cameraOffset(
  selfTopLeft: Vec2,
  avatarSize: number,
  viewport: Size,
  world: Size,
): Vec2 {
  const centerX = selfTopLeft.x + avatarSize / 2;
  const centerY = selfTopLeft.y + avatarSize / 2;
  return {
    x: clamp(viewport.width / 2 - centerX, Math.min(0, viewport.width - world.width), 0),
    y: clamp(viewport.height / 2 - centerY, Math.min(0, viewport.height - world.height), 0),
  };
}
