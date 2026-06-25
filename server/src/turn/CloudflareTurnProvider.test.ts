import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CloudflareTurnProvider } from './CloudflareTurnProvider.js';
import { ConsoleLogger } from '../logger.js';

const silent = new ConsoleLogger({ level: 'error', sink: () => {} });
const credentials = { keyId: 'key', apiToken: 'token' };
const stun = [{ urls: 'stun:stun.example:3478' }];

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const turnPayload = {
  iceServers: [
    { urls: ['turn:turn.example:3478?transport=udp'], username: 'u', credential: 'c' },
  ],
};

describe('CloudflareTurnProvider', () => {
  it('mints once and serves from cache within TTL', async () => {
    let calls = 0;
    const provider = new CloudflareTurnProvider({
      credentials,
      fallback: stun,
      logger: silent,
      now: () => 0,
      fetchFn: async () => {
        calls += 1;
        return jsonResponse(turnPayload);
      },
    });

    const first = await provider.getIceServers();
    const second = await provider.getIceServers();

    assert.equal(calls, 1);
    assert.equal(first.length, 1);
    assert.equal(second, first);
  });

  it('falls back to STUN on a non-OK response and caches the fallback', async () => {
    let calls = 0;
    const provider = new CloudflareTurnProvider({
      credentials,
      fallback: stun,
      logger: silent,
      now: () => 0,
      fetchFn: async () => {
        calls += 1;
        return jsonResponse({ error: 'invalid bearer token' }, 401);
      },
    });

    assert.deepEqual(await provider.getIceServers(), stun);
    await provider.getIceServers();
    assert.equal(calls, 1, 'fallback should be cached, not refetched every call');
  });

  it('coalesces concurrent refreshes into a single request', async () => {
    let calls = 0;
    const provider = new CloudflareTurnProvider({
      credentials,
      fallback: stun,
      logger: silent,
      now: () => 0,
      fetchFn: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return jsonResponse(turnPayload);
      },
    });

    await Promise.all([provider.getIceServers(), provider.getIceServers(), provider.getIceServers()]);
    assert.equal(calls, 1);
  });

  it('treats an empty ICE list as a failure', async () => {
    const provider = new CloudflareTurnProvider({
      credentials,
      fallback: stun,
      logger: silent,
      now: () => 0,
      fetchFn: async () => jsonResponse({ iceServers: [] }),
    });
    assert.deepEqual(await provider.getIceServers(), stun);
  });
});
