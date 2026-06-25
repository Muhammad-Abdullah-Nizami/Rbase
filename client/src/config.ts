import type { FalloffConfig, Size } from '@proximity/shared';

/**
 * In production this is baked at build time from the Render env var. In dev it
 * defaults to the signaling server on the same host (so LAN testing from a
 * phone hits the laptop's IP automatically).
 */
export const SIGNALING_URL: string =
  import.meta.env.VITE_SIGNALING_URL ?? `ws://${location.hostname}:8080`;

export const ROOM_NAME = 'main';

/** Canvas internal resolution (the visible slice of the world). */
export const VIEW: Size = { width: 160, height: 100 };

/** Display scale: each world pixel becomes SCALE screen pixels (crisp pixel art). */
export const SCALE = 6.25;

/** Avatar collision half-extents (roughly the sprite's feet footprint). */
export const AVATAR_HALF = { x: 5, y: 4 };

/** Movement speed in world units per millisecond (frame-rate independent). */
export const MOVE_SPEED = 0.066;

/** How close (world units) you must be to a seat to sit. */
export const SEAT_REACH = 18;

/** Distance→volume curve, in world units. silenceRadius is the audible range. */
export const FALLOFF: FalloffConfig = { fullVolumeRadius: 52, silenceRadius: 140 };

/** Volume multiplier per wall the line-of-sight crosses. 0 = walls fully block. */
export const OCCLUSION_PER_WALL = 0;

/** Normalized mic/stream level above which someone counts as "speaking". */
export const SPEAKING_THRESHOLD = 0.08;

/** Throttle for broadcasting our position (≈20 updates/sec). */
export const POSITION_SYNC_INTERVAL_MS = 50;
