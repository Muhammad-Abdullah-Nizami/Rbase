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
