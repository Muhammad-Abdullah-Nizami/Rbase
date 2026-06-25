import type { IceServer } from '@proximity/shared';
import type { IceServersProvider } from './IceServersProvider.js';

/** Returns a fixed list of ICE servers — used when no TURN credentials exist. */
export class StaticIceServersProvider implements IceServersProvider {
  constructor(private readonly servers: readonly IceServer[]) {}

  getIceServers(): Promise<readonly IceServer[]> {
    return Promise.resolve(this.servers);
  }
}
