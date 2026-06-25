import { worldMapSchema, type WorldMap } from '@proximity/shared';

/**
 * THE MAP — edit this file to change the layout.
 *
 * Layout: three equal rooms across the top (each a walled box with a doorway in
 * its south wall) opening into one big "Hall" below, which holds a Table. Walls
 * occlude audio and block movement; the doorway gaps let you walk and hear
 * through. Props (the table) are purely cosmetic. Coordinates are world pixels.
 *
 * Validated at load, so a malformed map fails immediately rather than silently.
 */

const T = 24; // wall thickness
const W = 1600; // world width
const H = 1120; // world height
const DIVIDE_Y = 430; // boundary between the top rooms and the hall

// Three equal top rooms: interior split into thirds by two vertical dividers.
const ROOM1_CX = 274;
const ROOM2_CX = 799;
const ROOM3_CX = 1325;
const DOOR_HALF = 60; // half of each doorway's width

export const defaultMap: WorldMap = worldMapSchema.parse({
  width: W,
  height: H,
  spawn: { x: 800, y: 950 }, // start in the hall, below the table

  walls: [
    // --- Outer perimeter ---
    { x: 0, y: 0, width: W, height: T }, // top
    { x: 0, y: H - T, width: W, height: T }, // bottom
    { x: 0, y: 0, width: T, height: H }, // left
    { x: W - T, y: 0, width: T, height: H }, // right

    // --- Two vertical dividers between the three top rooms ---
    { x: 525, y: T, width: T, height: DIVIDE_Y - T },
    { x: 1050, y: T, width: T, height: DIVIDE_Y - T },

    // --- Horizontal wall between the top rooms and the hall, with a doorway
    //     centered under each room (gaps around ROOMn_CX ± DOOR_HALF) ---
    { x: T, y: DIVIDE_Y, width: ROOM1_CX - DOOR_HALF - T, height: T },
    {
      x: ROOM1_CX + DOOR_HALF,
      y: DIVIDE_Y,
      width: ROOM2_CX - DOOR_HALF - (ROOM1_CX + DOOR_HALF),
      height: T,
    },
    {
      x: ROOM2_CX + DOOR_HALF,
      y: DIVIDE_Y,
      width: ROOM3_CX - DOOR_HALF - (ROOM2_CX + DOOR_HALF),
      height: T,
    },
    { x: ROOM3_CX + DOOR_HALF, y: DIVIDE_Y, width: W - T - (ROOM3_CX + DOOR_HALF), height: T },
  ],

  props: [
    // The table — sits in the middle of the hall, blocks nothing.
    { x: 620, y: 680, width: 360, height: 170, label: 'Table' },
  ],

  rooms: [
    { name: 'Room A', at: { x: 232, y: 200 } },
    { name: 'Room B', at: { x: 757, y: 200 } },
    { name: 'Room C', at: { x: 1283, y: 200 } },
    { name: 'Hall', at: { x: 762, y: 505 } },
  ],
});
