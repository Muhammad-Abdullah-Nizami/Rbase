import { worldMapSchema, type WorldMap } from '@proximity/shared';

/**
 * THE MAP — edit this file to change the layout.
 *
 * Coordinates are world pixels (the world is larger than the viewport; the
 * camera follows you). Walls are axis-aligned rectangles; leave a GAP between
 * walls to make a doorway you can walk and hear through. `spawn` is where you
 * start. `rooms` are just labels for orientation.
 *
 * Validated at load, so a malformed map fails immediately rather than silently.
 */
export const defaultMap: WorldMap = worldMapSchema.parse({
  width: 1600,
  height: 1200,
  spawn: { x: 360, y: 300 },
  walls: [
    // Vertical divider with a central doorway (gap y 520..680).
    { x: 780, y: 0, width: 40, height: 520 },
    { x: 780, y: 680, width: 40, height: 520 },
    // Horizontal divider with a central doorway (gap x 680..840).
    { x: 0, y: 580, width: 680, height: 40 },
    { x: 840, y: 580, width: 760, height: 40 },
  ],
  rooms: [
    { name: 'Lounge', at: { x: 320, y: 250 } },
    { name: 'Library', at: { x: 1160, y: 250 } },
    { name: 'Garden', at: { x: 320, y: 870 } },
    { name: 'Studio', at: { x: 1160, y: 870 } },
  ],
});
