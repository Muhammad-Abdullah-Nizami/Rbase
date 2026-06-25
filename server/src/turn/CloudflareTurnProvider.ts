import { decodeIceServers, type IceServer } from '@proximity/shared';
import type { Logger } from '../logger.js';
import type { TurnCredentials } from '../config.js';
import type { IceServersProvider } from './IceServersProvider.js';

export interface CloudflareTurnProviderOptions {
  readonly credentials: TurnCredentials;
  /** Returned (and cached briefly) whenever minting fails. Typically STUN. */
  readonly fallback: readonly IceServer[];
  readonly logger: Logger;
  readonly credentialTtlSeconds?: number;
  readonly cacheTtlMs?: number;
  readonly fallbackTtlMs?: number;
  readonly fetchTimeoutMs?: number;
  /** Injectable for tests. */
  readonly fetchFn?: typeof fetch;
  /** Injectable monotonic clock (ms). Injectable for tests. */
  readonly now?: () => number;
}

interface CacheEntry {
  readonly servers: readonly IceServer[];
  readonly expiresAt: number;
}

function endpoint(keyId: string): string {
  return `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`;
}

/**
 * Mints short-lived ICE servers from Cloudflare Realtime TURN.
 *
 * Robustness properties:
 *  - results are cached until near expiry (one network call per ~12h, not per join);
 *  - concurrent refreshes are coalesced into a single in-flight request;
 *  - the request is bounded by a timeout so a slow endpoint can't stall joins;
 *  - any failure degrades gracefully to a cached STUN fallback.
 */
export class CloudflareTurnProvider implements IceServersProvider {
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly credentialTtlSeconds: number;
  private readonly cacheTtlMs: number;
  private readonly fallbackTtlMs: number;
  private readonly fetchTimeoutMs: number;

  private cache: CacheEntry | null = null;
  private inflight: Promise<readonly IceServer[]> | null = null;

  constructor(private readonly options: CloudflareTurnProviderOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.now = options.now ?? Date.now;
    this.credentialTtlSeconds = options.credentialTtlSeconds ?? 86_400;
    this.cacheTtlMs = options.cacheTtlMs ?? 12 * 60 * 60 * 1000;
    this.fallbackTtlMs = options.fallbackTtlMs ?? 60 * 1000;
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? 4_000;
  }

  async getIceServers(): Promise<readonly IceServer[]> {
    if (this.cache && this.now() < this.cache.expiresAt) return this.cache.servers;
    // Coalesce: a burst of joins on a cold cache triggers exactly one mint.
    this.inflight ??= this.refresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async refresh(): Promise<readonly IceServer[]> {
    try {
      const servers = await this.mint();
      this.cache = { servers, expiresAt: this.now() + this.cacheTtlMs };
      this.options.logger.info('minted TURN credentials', { count: servers.length });
      return servers;
    } catch (error) {
      this.options.logger.error('TURN mint failed; serving STUN fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.cache = { servers: this.options.fallback, expiresAt: this.now() + this.fallbackTtlMs };
      return this.options.fallback;
    }
  }

  private async mint(): Promise<readonly IceServer[]> {
    const response = await this.fetchFn(endpoint(this.options.credentials.keyId), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.options.credentials.apiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ttl: this.credentialTtlSeconds }),
      signal: AbortSignal.timeout(this.fetchTimeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Cloudflare TURN responded ${response.status}`);
    }
    const body = (await response.json()) as { iceServers?: unknown };
    const servers = decodeIceServers(body.iceServers);
    if (!servers || servers.length === 0) {
      throw new Error('Cloudflare TURN returned no usable ICE servers');
    }
    return servers;
  }
}
