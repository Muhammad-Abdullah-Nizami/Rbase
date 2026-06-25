// Builds the static pixel-art world (floor, furniture, walls) and the minimap
// onto offscreen canvases once. Ported from the design mockup; furniture is
// drawn procedurally to match the map's room layout.

import type { Rect, WorldMap } from '@proximity/shared';
import { shade } from './sprites';

type Ctx = CanvasRenderingContext2D;

function context(canvas: HTMLCanvasElement): Ctx {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function ell(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, col: string): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, col: string): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function px(ctx: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
}

function fillPlanks(ctx: Ctx, X: number, Y: number, W: number, H: number, base: string): void {
  ctx.fillStyle = base;
  ctx.fillRect(X, Y, W, H);
  const seam = shade(base, -0.28);
  const hi = shade(base, 0.16);
  let b = 0;
  for (let yy = Y; yy < Y + H; yy += 12) {
    const hh = Math.min(12, Y + H - yy);
    if (b % 2 === 0) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = hi;
      ctx.fillRect(X, yy, W, hh);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = seam;
    ctx.fillRect(X, yy, W, 1);
    const st = b % 2 ? X + 52 : X;
    for (let xx = st; xx < X + W; xx += 104) ctx.fillRect(xx, yy, 1, hh);
    b += 1;
  }
}

function drawWall(ctx: Ctx, r: Rect): void {
  ctx.fillStyle = '#8a5a36';
  ctx.fillRect(r.x, r.y, r.width, r.height);
  ctx.fillStyle = '#b5895a';
  ctx.fillRect(r.x, r.y, r.width, 1);
  ctx.fillRect(r.x, r.y, 1, r.height);
  ctx.fillStyle = '#5c3a23';
  ctx.fillRect(r.x, r.y + r.height - 2, r.width, 2);
  ctx.fillRect(r.x + r.width - 2, r.y, 2, r.height);
  ctx.fillStyle = '#6f4527';
  ctx.globalAlpha = 0.5;
  if (r.width > r.height) {
    for (let x = r.x + 16; x < r.x + r.width; x += 16) ctx.fillRect(x, r.y + 1, 1, r.height - 3);
  } else {
    for (let y = r.y + 16; y < r.y + r.height; y += 16) ctx.fillRect(r.x + 1, y, r.width - 3, 1);
  }
  ctx.globalAlpha = 1;
}

function drawPlant(ctx: Ctx, x: number, y: number): void {
  const L = '#6e9c5a';
  const LD = '#588046';
  const LH = '#8cbf72';
  ell(ctx, x + 8, y + 22, 11, 4, 'rgba(58,38,22,0.16)');
  px(ctx, x + 2, y - 6, 14, 12, LD);
  px(ctx, x + 3, y - 8, 12, 10, L);
  px(ctx, x + 1, y - 2, 5, 8, L);
  px(ctx, x + 12, y - 2, 5, 8, L);
  px(ctx, x + 5, y - 11, 7, 6, LH);
  px(ctx, x + 4, y - 4, 3, 3, LH);
  px(ctx, x + 11, y - 5, 3, 3, LH);
  px(ctx, x + 8, y - 13, 2, 3, L);
  px(ctx, x + 2, y - 7, 2, 3, L);
  px(ctx, x + 14, y - 6, 2, 3, L);
  px(ctx, x + 2, y + 6, 14, 4, '#a85b39');
  px(ctx, x + 3, y + 9, 12, 9, '#c2714b');
  px(ctx, x + 3, y + 9, 12, 1, '#d4895f');
  px(ctx, x + 4, y + 10, 2, 7, '#d4895f');
}

function chairBack(ctx: Ctx, cx: number, ty: number, cushion: string): void {
  ell(ctx, cx, ty + 17, 12, 4, 'rgba(58,38,22,0.14)');
  px(ctx, cx - 9, ty + 8, 3, 9, '#6f4527');
  px(ctx, cx + 6, ty + 8, 3, 9, '#6f4527');
  px(ctx, cx - 9, ty + 5, 18, 4, '#8a5a36');
  px(ctx, cx - 10, ty - 3, 3, 12, '#6f4527');
  px(ctx, cx + 7, ty - 3, 3, 12, '#6f4527');
  px(ctx, cx - 10, ty - 5, 20, 3, '#8a5a36');
  px(ctx, cx - 7, ty - 2, 14, 9, shade(cushion, -0.18));
  px(ctx, cx - 6, ty - 1, 12, 7, cushion);
  px(ctx, cx - 5, ty, 10, 2, shade(cushion, 0.22));
}

function drawWorkstation(ctx: Ctx, cx: number, cy: number, accent: string): void {
  rrect(ctx, cx - 32, cy - 24, 64, 50, 8, shade(accent, -0.12));
  rrect(ctx, cx - 31, cy - 23, 62, 48, 7, accent);
  rrect(ctx, cx - 26, cy - 19, 52, 40, 6, shade(accent, 0.16));
  ell(ctx, cx, cy + 2, 28, 8, 'rgba(58,38,22,0.16)');
  px(ctx, cx - 19, cy - 2, 4, 12, '#6f4527');
  px(ctx, cx + 15, cy - 2, 4, 12, '#6f4527');
  px(ctx, cx - 22, cy - 12, 44, 8, '#a9743a');
  px(ctx, cx - 22, cy - 14, 44, 3, '#c89b5e');
  px(ctx, cx - 22, cy - 14, 44, 1, '#dab277');
  ctx.globalAlpha = 0.14;
  for (let gx = cx - 18; gx < cx + 18; gx += 8) px(ctx, gx, cy - 11, 1, 6, '#000');
  ctx.globalAlpha = 1;
  px(ctx, cx - 10, cy - 26, 20, 11, '#2f3a42');
  px(ctx, cx - 8, cy - 24, 16, 8, '#bfe6e6');
  ctx.globalAlpha = 0.5;
  px(ctx, cx - 8, cy - 24, 16, 4, '#88c6c9');
  ctx.globalAlpha = 1;
  for (let i = 0; i < 3; i += 1) px(ctx, cx - 6, cy - 23 + i * 2, 6 + i * 3, 1, i % 2 ? '#88c6c9' : '#e9f6ee');
  px(ctx, cx - 11, cy - 15, 22, 2, '#44525d');
  px(ctx, cx - 11, cy - 13, 22, 3, '#5b6b78');
  px(ctx, cx - 11, cy - 13, 22, 1, '#6f8290');
  px(ctx, cx + 13, cy - 18, 5, 5, '#e7eef0');
  px(ctx, cx + 13, cy - 18, 5, 1, '#c4d2d6');
  chairBack(ctx, cx, cy + 6, '#cc8d86');
}

function drawWindow(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  px(ctx, x - 1, y - 1, w + 2, h + 2, '#8a5a36');
  px(ctx, x - 1, y - 1, w + 2, 1, '#9c6a40');
  px(ctx, x, y, w, h, '#bfe0e8');
  px(ctx, x, y + h / 2, w, h / 2, '#9fcad6');
  px(ctx, x + w / 2 - 1, y, 2, h, '#8a5a36');
  px(ctx, x, y + h / 2 - 1, w, 2, '#8a5a36');
}

function drawBookshelfV(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  px(ctx, x, y, w, h, '#6f4527');
  px(ctx, x + 3, y + 1, w - 4, h - 2, '#7a4e2d');
  px(ctx, x, y, 3, h, '#5c3a23');
  px(ctx, x + w - 2, y, 2, h, '#9c6a40');
  const cols = ['#cc8d86', '#7fa66a', '#d9a24f', '#6f8aa8', '#b86f9c', '#5b6b78'];
  const rows = Math.max(2, Math.floor((h - 4) / 13));
  let ci = 0;
  for (let s = 0; s < rows; s += 1) {
    const sy = y + 3 + s * 13;
    px(ctx, x + 3, sy - 1, w - 3, 11, '#5c3a23');
    let bx = x + 5;
    while (bx < x + w - 3) {
      const bw = 2 + (ci % 2);
      const bh = 7 + ((ci * 2) % 3);
      px(ctx, bx, sy + (9 - bh), bw, bh, cols[ci % cols.length]!);
      px(ctx, bx, sy + (9 - bh), bw, 1, '#ffffff');
      bx += bw + 1;
      ci += 1;
    }
    px(ctx, x + 3, sy + 10, w - 3, 2, '#4a3526');
  }
}

function drawHall(ctx: Ctx, cx: number, cy: number): void {
  rrect(ctx, cx - 58, cy - 30, 116, 64, 10, '#6e9459');
  rrect(ctx, cx - 56, cy - 28, 112, 60, 9, '#7fa66a');
  rrect(ctx, cx - 48, cy - 22, 96, 48, 7, '#93b97f');
  ell(ctx, cx, cy + 4, 52, 11, 'rgba(58,38,22,0.16)');
  px(ctx, cx - 46, cy - 4, 8, 12, '#6f4527');
  px(ctx, cx + 38, cy - 4, 8, 12, '#6f4527');
  px(ctx, cx - 50, cy - 14, 100, 10, '#a9743a');
  px(ctx, cx - 50, cy - 16, 100, 3, '#c89b5e');
  px(ctx, cx - 50, cy - 16, 100, 1, '#dab277');
  px(ctx, cx - 30, cy - 26, 18, 10, '#2f3a42');
  px(ctx, cx - 28, cy - 24, 14, 6, '#bfe6e6');
  px(ctx, cx + 14, cy - 26, 18, 10, '#2f3a42');
  px(ctx, cx + 16, cy - 24, 14, 6, '#bfe6e6');
  px(ctx, cx - 4, cy - 21, 5, 5, '#e7eef0');
  px(ctx, cx - 30, cy - 30, 16, 7, '#9c6a40');
  px(ctx, cx - 30, cy - 30, 16, 2, '#b5895a');
  px(ctx, cx + 12, cy - 30, 16, 7, '#9c6a40');
  px(ctx, cx + 12, cy - 30, 16, 2, '#b5895a');
  chairBack(ctx, cx - 22, cy + 10, '#6f8aa8');
  chairBack(ctx, cx + 20, cy + 10, '#cc8d86');
}

const DOORWAYS = [58, 168, 278];

/** The full static world painted once at native (world) resolution. */
export function buildWorldCanvas(map: WorldMap): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = map.width;
  canvas.height = map.height;
  const ctx = context(canvas);

  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(0, 0, map.width, map.height);
  fillPlanks(ctx, 6, 6, 104, 92, '#c2904f');
  fillPlanks(ctx, 116, 6, 104, 92, '#c2904f');
  fillPlanks(ctx, 226, 6, 104, 92, '#c2904f');
  fillPlanks(ctx, 6, 104, 324, 110, '#bd8a4a');
  drawWorkstation(ctx, 58, 50, '#7fa66a');
  drawWorkstation(ctx, 168, 50, '#6f8aa8');
  drawWorkstation(ctx, 278, 50, '#cc8d86');
  drawPlant(ctx, 90, 70);
  drawPlant(ctx, 196, 70);
  drawPlant(ctx, 306, 70);
  drawHall(ctx, 168, 158);
  drawPlant(ctx, 14, 188);
  drawPlant(ctx, 306, 188);
  drawBookshelfV(ctx, 6, 116, 18, 54);
  for (const wall of map.walls) drawWall(ctx, wall);
  for (const dx of DOORWAYS) {
    ctx.fillStyle = '#d2a96a';
    ctx.fillRect(dx - 12, 99, 24, 4);
    ctx.fillStyle = '#e0bd86';
    ctx.fillRect(dx - 12, 99, 24, 1);
  }
  for (const wx of DOORWAYS) drawWindow(ctx, wx - 18, 1, 36, 5);
  return canvas;
}

export interface Minimap {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
}

/** The minimap background (rooms + walls) at `scale` of world size. */
export function buildMinimapBase(map: WorldMap, scale: number): Minimap {
  const width = Math.round(map.width * scale);
  const height = Math.round(map.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = context(canvas);

  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(0, 0, width, height);
  const R = (X: number, Y: number, W: number, H: number, col: string): void => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(X * scale), Math.round(Y * scale), Math.round(W * scale), Math.round(H * scale));
  };
  R(6, 6, 104, 92, '#caa066');
  R(116, 6, 104, 92, '#caa066');
  R(226, 6, 104, 92, '#caa066');
  R(6, 104, 324, 110, '#c0975a');
  R(40, 32, 36, 28, '#9bbf86');
  R(150, 32, 36, 28, '#9fb6cf');
  R(260, 32, 36, 28, '#dba8a2');
  R(118, 130, 100, 52, '#9bbf86');
  for (const wall of map.walls) R(wall.x, wall.y, wall.width, wall.height, '#5c3a23');
  return { canvas, width, height };
}
