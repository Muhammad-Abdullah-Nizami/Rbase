import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { volumeForDistance, distance, clampToBounds, type FalloffConfig } from './geometry.js';

const cfg: FalloffConfig = { fullVolumeRadius: 100, silenceRadius: 300 };

describe('volumeForDistance', () => {
  it('is full volume within the full radius', () => {
    assert.equal(volumeForDistance(0, cfg), 1);
    assert.equal(volumeForDistance(100, cfg), 1);
  });

  it('is silent at or beyond the silence radius', () => {
    assert.equal(volumeForDistance(300, cfg), 0);
    assert.equal(volumeForDistance(10_000, cfg), 0);
  });

  it('fades linearly in between', () => {
    assert.equal(volumeForDistance(200, cfg), 0.5);
    assert.equal(volumeForDistance(150, cfg), 0.75);
  });

  it('never divides by zero on a degenerate config', () => {
    const degenerate: FalloffConfig = { fullVolumeRadius: 100, silenceRadius: 100 };
    assert.equal(volumeForDistance(100, degenerate), 1);
    assert.equal(volumeForDistance(101, degenerate), 0);
  });

  it('clamps inverted radii instead of returning NaN', () => {
    const inverted: FalloffConfig = { fullVolumeRadius: 300, silenceRadius: 100 };
    const v = volumeForDistance(200, inverted);
    assert.ok(Number.isFinite(v));
    assert.ok(v >= 0 && v <= 1);
  });
});

describe('distance', () => {
  it('computes euclidean distance', () => {
    assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  });
});

describe('clampToBounds', () => {
  it('keeps an avatar fully inside the room', () => {
    assert.deepEqual(clampToBounds({ x: -10, y: 999 }, { width: 800, height: 600 }, 32), {
      x: 0,
      y: 568,
    });
  });

  it('leaves an in-bounds position unchanged', () => {
    assert.deepEqual(clampToBounds({ x: 100, y: 200 }, { width: 800, height: 600 }, 32), {
      x: 100,
      y: 200,
    });
  });
});
