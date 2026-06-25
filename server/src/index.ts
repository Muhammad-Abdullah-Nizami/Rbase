/**
 * Composition root. The only place that knows how the pieces fit together:
 * it reads config, picks an ICE provider, builds the signaling service, mounts
 * the WebSocket gateway on an HTTP server, and wires graceful shutdown.
 */

import { resolve } from 'node:path';
import type { IceServer } from '@proximity/shared';
import { loadConfig } from './config.js';
import { ConsoleLogger } from './logger.js';
import { createHealthServer } from './http/healthServer.js';
import { RoomRegistry } from './signaling/RoomRegistry.js';
import { SignalingService } from './signaling/SignalingService.js';
import { WebSocketGateway } from './ws/WebSocketGateway.js';
import { CloudflareTurnProvider } from './turn/CloudflareTurnProvider.js';
import { StaticIceServersProvider } from './turn/StaticIceServersProvider.js';
import type { IceServersProvider } from './turn/IceServersProvider.js';

loadDotEnvForDev();

const config = loadConfig(process.env);
const logger = new ConsoleLogger({ level: config.logLevel, context: { service: 'signaling' } });

const stunServers: IceServer[] = config.stunUrls.map((urls) => ({ urls }));

const iceProvider: IceServersProvider = config.turn
  ? new CloudflareTurnProvider({
      credentials: config.turn,
      fallback: stunServers,
      credentialTtlSeconds: config.turnCredentialTtlSeconds,
      cacheTtlMs: config.iceCacheTtlMs,
      fallbackTtlMs: config.iceFallbackTtlMs,
      fetchTimeoutMs: config.turnFetchTimeoutMs,
      logger: logger.child({ component: 'turn' }),
    })
  : new StaticIceServersProvider(stunServers);

if (!config.turn) {
  logger.warn('no TURN credentials configured — running STUN-only (strict NATs may fail)');
}

const rooms = new RoomRegistry();
const service = new SignalingService({ rooms, iceProvider, logger });
const httpServer = createHealthServer();
const gateway = new WebSocketGateway({ server: httpServer, service, logger });

httpServer.listen(config.port, () => {
  logger.info('signaling server listening', { port: config.port });
});

installShutdownHandlers();

function installShutdownHandlers(): void {
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutting down', { signal });
    await gateway.close();
    httpServer.close(() => {
      logger.info('closed cleanly');
      process.exit(0);
    });
    // Hard exit if a connection refuses to drain.
    setTimeout(() => process.exit(1), 5_000).unref();
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

function loadDotEnvForDev(): void {
  if (process.env.NODE_ENV === 'production') return;
  try {
    process.loadEnvFile(resolve(import.meta.dirname, '../../.env'));
  } catch {
    // No local .env — environment is already populated (e.g. on Render).
  }
}
