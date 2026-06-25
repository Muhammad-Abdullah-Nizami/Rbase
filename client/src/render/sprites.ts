// Pixel-art character ("trainer") sprite engine, ported from the design mockup.
// Sprites are tiny ASCII-art grids painted pixel-by-pixel into a 16x24 buffer.

export type Facing = 'up' | 'down' | 'left' | 'right';

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb hex colour. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

const ART = {
  down: [
    '......1111......', '....11111111....', '...1111111111...', '...1113331111...',
    '...1111111111...', '..222222222222..', '...4555555554...', '...4557555754...',
    '...4555555554...', '....55555555....', '....88888888....', '...a88888888a...',
    '..a8888888888a..', '..588888888885..', '...8888888888...',
  ],
  up: [
    '......1111......', '....11111111....', '...1111111111...', '...1111111111...',
    '...1113331111...', '...1111111111...', '...4444444444...', '...4444444444...',
    '...4444444444...', '....44444444....', '....88888888....', '...a88kkkk88a...',
    '..a88KKKKKK88a..', '..588KKKKKK885..', '...8888888888...',
  ],
  side: [
    '......11111.....', '.....1111111....', '....111111111...', '....133111111...',
    '....111111111...', '..22221111111...', '....55555544....', '...5755555544...',
    '...5555555544...', '....55555544....', '....88888888....', '...88888888a....',
    '..5888888888....', '...88888888a....', '...88888888.....',
  ],
  legsStand: [
    '...bbbbbbbbbb...', '...bbbb..bbbb...', '...cbbb..bbbc...', '...cbbb..bbbc...',
    '...cbbb..bbbc...', '...dddd..dddd...', '...eeee..eeee...',
  ],
  legsA: [
    '...bbbbbbbbbb...', '...bbbb..bbbb...', '...cbbb..bbbc...', '...dddd..bbbc...',
    '...eeee..bbbc...', '.........dddd...', '.........eeee...',
  ],
  legsB: [
    '...bbbbbbbbbb...', '...bbbb..bbbb...', '...cbbb..bbbc...', '...cbbb..dddd...',
    '...cbbb..eeee...', '...dddd.........', '...eeee.........',
  ],
  legsSit: [
    '...bbbbbbbbbb...', '...bbbbbbbbbb...', '...cbbbbbbbbc...', '....cbbbbbbc....',
    '................', '................', '................',
  ],
} as const;

function trainerPalette(shirt: string, cap: string): Record<string, string> {
  return {
    '1': cap, '2': shade(cap, -0.22), '3': shade(cap, 0.3),
    '4': '#4a3526', '5': '#f1c49c', '6': '#d39e76', '7': '#33271f',
    '8': shirt, '9': shade(shirt, -0.2), 'a': shade(shirt, 0.22),
    'b': '#41506b', 'c': '#33405a', 'd': '#5a3d2b', 'e': '#432c1f',
    'k': '#5c3a23', 'K': '#7a4e2d',
  };
}

function drawArt(
  ctx: CanvasRenderingContext2D,
  art: readonly string[],
  pal: Record<string, string>,
  ox: number,
  oy: number,
): void {
  for (let y = 0; y < art.length; y += 1) {
    const row = art[y];
    if (row === undefined) continue;
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x];
      if (ch === undefined || ch === '.' || ch === ' ') continue;
      const colour = pal[ch];
      if (!colour) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

export interface TrainerOptions {
  readonly facing: Facing;
  readonly frame: number;
  readonly shirt: string;
  readonly cap: string;
  readonly sitting: boolean;
}

/** Paint a trainer into a 16x24 context (cleared first). */
export function renderTrainer(ctx: CanvasRenderingContext2D, o: TrainerOptions): void {
  ctx.clearRect(0, 0, 16, 24);
  const body = o.sitting || o.facing === 'up'
    ? ART.up
    : o.facing === 'left' || o.facing === 'right'
      ? ART.side
      : ART.down;
  const legs = o.sitting
    ? ART.legsSit
    : o.frame === 1
      ? ART.legsA
      : o.frame === 2
        ? ART.legsB
        : ART.legsStand;
  const pal = trainerPalette(o.shirt, o.cap);
  drawArt(ctx, body, pal, 0, 0);
  drawArt(ctx, legs, pal, 0, 15);
}
