/**
 * The world map schema — the contract for a hand-editable map file. Walls are
 * axis-aligned rectangles; leaving gaps between them creates doorways. `spawn`
 * is the starting position; `rooms` are optional labels for the UI.
 */

import { z } from 'zod';
import { vec2Schema } from './protocol.js';

export const rectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type RectData = z.infer<typeof rectSchema>;

export const roomLabelSchema = z.object({
  name: z.string(),
  at: vec2Schema,
});
export type RoomLabel = z.infer<typeof roomLabelSchema>;

export const worldMapSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  spawn: vec2Schema,
  walls: z.array(rectSchema),
  rooms: z.array(roomLabelSchema).default([]),
});
export type WorldMap = z.infer<typeof worldMapSchema>;

/** Validate raw map data, throwing on anything malformed (fail fast at load). */
export function parseWorldMap(raw: unknown): WorldMap {
  return worldMapSchema.parse(raw);
}
