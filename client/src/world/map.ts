import { worldMapSchema, type WorldMap } from '@proximity/shared';

/**
 * THE MAP — edit this file to change the layout. Coordinates are world pixels
 * in the pixel-art space (the renderer scales them up). Three rooms (A/B/C)
 * across the top with a doorway each, opening into the Hall below. Walls occlude
 * audio and block movement; gaps between wall segments are the doorways. `seats`
 * are spots you can sit at with E.
 */
export const defaultMap: WorldMap = worldMapSchema.parse({
  width: 336,
  height: 220,
  spawn: { x: 168, y: 176 },
  walls: [
    // Outer perimeter
    { x: 0, y: 0, width: 336, height: 6 },
    { x: 0, y: 214, width: 336, height: 6 },
    { x: 0, y: 0, width: 6, height: 220 },
    { x: 330, y: 0, width: 6, height: 220 },
    // Two vertical dividers between the three top rooms
    { x: 110, y: 6, width: 6, height: 92 },
    { x: 220, y: 6, width: 6, height: 92 },
    // Horizontal wall with doorway gaps centered at x = 58, 168, 278
    { x: 6, y: 98, width: 38, height: 6 },
    { x: 72, y: 98, width: 82, height: 6 },
    { x: 182, y: 98, width: 82, height: 6 },
    { x: 292, y: 98, width: 38, height: 6 },
  ],
  seats: [
    // Desks in rooms A / B / C
    { x: 58, y: 68 },
    { x: 168, y: 68 },
    { x: 278, y: 68 },
    // Hall table
    { x: 146, y: 180 },
    { x: 188, y: 180 },
  ],
});

/** Which room a world position is in (used for the room-name tab). */
export function roomNameAt(x: number, y: number): string {
  if (y < 98) return x < 110 ? 'Room A' : x < 220 ? 'Room B' : 'Room C';
  return 'Hall';
}
