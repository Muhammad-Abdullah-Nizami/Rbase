import { occlusionBetween, volumeBetween, type FalloffConfig, type Rect } from '@proximity/shared';
import type { AudioEngine } from './AudioEngine';
import type { RoomModel } from '../room/RoomModel';

/**
 * Bridges spatial state and audio: every tick it maps each peer's distance to a
 * gain, then multiplies by wall occlusion (so walls between you muffle/block
 * the sound and doorways let it through). Both curves live in shared,
 * unit-tested geometry.
 */
export class ProximityController {
  constructor(
    private readonly model: RoomModel,
    private readonly audio: AudioEngine,
    private readonly falloff: FalloffConfig,
    private readonly walls: readonly Rect[],
    private readonly occlusionPerWall: number,
  ) {}

  update(): void {
    const self = this.model.self.position;
    for (const peer of this.model.peers()) {
      const distanceGain = volumeBetween(self, peer.position, this.falloff);
      // Skip the occlusion raycast when distance already silences the peer.
      const gain =
        distanceGain === 0
          ? 0
          : distanceGain * occlusionBetween(self, peer.position, this.walls, this.occlusionPerWall);
      this.audio.setGain(peer.id, gain);
    }
  }
}
