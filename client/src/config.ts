import type { Bounds, FalloffConfig } from '@proximity/shared';

/**
 * In production this is baked at build time from the Render env var. In dev it
 * defaults to the signaling server on the same host (so LAN testing from a
 * phone hits the laptop's IP automatically).
 */
export const SIGNALING_URL: string =
  import.meta.env.VITE_SIGNALING_URL ?? `ws://${location.hostname}:8080`;

export const ROOM_NAME = 'main';

export const ROOM_BOUNDS: Bounds = { width: 800, height: 600 };
export const AVATAR_SIZE = 32;
export const MOVE_SPEED = 4;

/** Distance→volume curve, in room pixels. */
export const FALLOFF: FalloffConfig = { fullVolumeRadius: 90, silenceRadius: 340 };

/** Throttle for broadcasting our position (≈20 updates/sec). */
export const POSITION_SYNC_INTERVAL_MS = 50;
