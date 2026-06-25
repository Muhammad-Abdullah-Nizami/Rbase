import type { FalloffConfig, Size } from '@proximity/shared';

/**
 * In production this is baked at build time from the Render env var. In dev it
 * defaults to the signaling server on the same host (so LAN testing from a
 * phone hits the laptop's IP automatically).
 */
export const SIGNALING_URL: string =
  import.meta.env.VITE_SIGNALING_URL ?? `ws://${location.hostname}:8080`;

export const ROOM_NAME = 'main';

export const AVATAR_SIZE = 32;
export const MOVE_SPEED = 4;

/** The camera window. The world (from the map) is larger and scrolls under it. */
export const VIEWPORT: Size = { width: 900, height: 600 };

/** Distance→volume curve, in world pixels (tuned for room-scale distances). */
export const FALLOFF: FalloffConfig = { fullVolumeRadius: 160, silenceRadius: 700 };

/**
 * Volume multiplier for each wall the line between two people crosses.
 * 0 = walls fully block sound, 1 = walls don't block at all. 0.12 ≈ a strong
 * muffle (two walls ≈ near silence), while doorway gaps stay clear.
 */
export const OCCLUSION_PER_WALL = 0.12;

/** Throttle for broadcasting our position (≈20 updates/sec). */
export const POSITION_SYNC_INTERVAL_MS = 50;
