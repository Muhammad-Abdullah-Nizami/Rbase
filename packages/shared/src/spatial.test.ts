import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  segmentIntersectsRect,
  rectsOverlap,
  occlusionBetween,
  cameraOffset,
  type Rect,
} from './geometry.js';

const wall: Rect = { x: 100, y: 0, width: 20, height: 100 };

describe('segmentIntersectsRect', () => {
  it('detects a segment crossing the rect', () => {
    assert.equal(segmentIntersectsRect({ x: 0, y: 50 }, { x: 200, y: 50 }, wall), true);
  });

  it('returns false when the segment passes beside the rect', () => {
    assert.equal(segmentIntersectsRect({ x: 0, y: 150 }, { x: 200, y: 150 }, wall), false);
  });

  it('returns true when an endpoint is inside the rect', () => {
    assert.equal(segmentIntersectsRect({ x: 110, y: 50 }, { x: 300, y: 50 }, wall), true);
  });

  it('handles a vertical segment (parallel slab case) without false positives', () => {
    assert.equal(segmentIntersectsRect({ x: 50, y: 0 }, { x: 50, y: 100 }, wall), false);
    assert.equal(segmentIntersectsRect({ x: 110, y: -50 }, { x: 110, y: 200 }, wall), true);
  });
});

describe('rectsOverlap', () => {
  it('true when boxes overlap', () => {
    assert.equal(rectsOverlap({ x: 0, y: 0, width: 50, height: 50 }, { x: 40, y: 40, width: 50, height: 50 }), true);
  });
  it('false when boxes only touch edges', () => {
    assert.equal(rectsOverlap({ x: 0, y: 0, width: 50, height: 50 }, { x: 50, y: 0, width: 50, height: 50 }), false);
  });
  it('false when disjoint', () => {
    assert.equal(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 100, width: 10, height: 10 }), false);
  });
});

describe('occlusionBetween', () => {
  // Two wall segments with a doorway gap between y=100 and y=140.
  const walls: Rect[] = [
    { x: 200, y: 0, width: 20, height: 100 },
    { x: 200, y: 140, width: 20, height: 100 },
  ];

  it('is 1 when no wall is in the way', () => {
    assert.equal(occlusionBetween({ x: 0, y: 50 }, { x: 100, y: 50 }, walls, 0.1), 1);
  });

  it('attenuates once per wall crossed', () => {
    // Straight horizontal line at y=50 crosses the first wall only.
    assert.ok(Math.abs(occlusionBetween({ x: 0, y: 50 }, { x: 400, y: 50 }, walls, 0.1) - 0.1) < 1e-9);
  });

  it('leaks through a doorway gap (no attenuation)', () => {
    // Line at y=120 passes through the gap between the two wall segments.
    assert.equal(occlusionBetween({ x: 0, y: 120 }, { x: 400, y: 120 }, walls, 0.1), 1);
  });

  it('compounds across multiple walls', () => {
    const two: Rect[] = [
      { x: 100, y: 0, width: 10, height: 100 },
      { x: 300, y: 0, width: 10, height: 100 },
    ];
    assert.ok(Math.abs(occlusionBetween({ x: 0, y: 50 }, { x: 400, y: 50 }, two, 0.2) - 0.04) < 1e-9);
  });
});

describe('cameraOffset', () => {
  const viewport = { width: 800, height: 600 };
  const world = { width: 1600, height: 1200 };

  it('centers the avatar when it is in open space', () => {
    assert.deepEqual(cameraOffset({ x: 800, y: 600 }, 32, viewport, world), {
      x: 800 / 2 - (800 + 16),
      y: 600 / 2 - (600 + 16),
    });
  });

  it('clamps at the top-left edge (no empty space shown)', () => {
    assert.deepEqual(cameraOffset({ x: 0, y: 0 }, 32, viewport, world), { x: 0, y: 0 });
  });

  it('clamps at the bottom-right edge', () => {
    assert.deepEqual(cameraOffset({ x: 1600, y: 1200 }, 32, viewport, world), {
      x: viewport.width - world.width,
      y: viewport.height - world.height,
    });
  });
});
