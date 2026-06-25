import type { IceServer } from '@proximity/shared';

/**
 * Port (in the hexagonal-architecture sense) for obtaining the ICE servers a
 * client should use for WebRTC. The signaling layer depends only on this
 * interface, so the TURN implementation can be swapped (Cloudflare, static
 * STUN, a fake in tests) without touching domain logic.
 */
export interface IceServersProvider {
  getIceServers(): Promise<readonly IceServer[]>;
}
