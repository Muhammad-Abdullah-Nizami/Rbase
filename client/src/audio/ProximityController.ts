import { volumeBetween, type FalloffConfig } from '@proximity/shared';
import type { AudioEngine } from './AudioEngine';
import type { RoomModel } from '../room/RoomModel';

/**
 * Bridges spatial state and audio: every tick it maps each peer's distance to a
 * gain value and pushes it into the AudioEngine. The actual curve lives in the
 * shared, unit-tested `volumeBetween`.
 */
export class ProximityController {
  constructor(
    private readonly model: RoomModel,
    private readonly audio: AudioEngine,
    private readonly falloff: FalloffConfig,
  ) {}

  update(): void {
    const self = this.model.self.position;
    for (const peer of this.model.peers()) {
      this.audio.setGain(peer.id, volumeBetween(self, peer.position, this.falloff));
    }
  }
}
