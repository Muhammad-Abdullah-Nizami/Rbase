/**
 * Environment parsing and validation. Fails fast with a clear error on bad
 * input rather than letting a malformed value surface as a confusing runtime
 * bug later. The result is a fully-typed, immutable config object.
 */

import type { LogLevel } from './logger.js';

export interface TurnCredentials {
  readonly keyId: string;
  readonly apiToken: string;
}

export interface ServerConfig {
  readonly port: number;
  readonly logLevel: LogLevel;
  /** TURN credentials, or null to run STUN-only (still works on friendly NATs). */
  readonly turn: TurnCredentials | null;
  readonly turnCredentialTtlSeconds: number;
  readonly iceCacheTtlMs: number;
  readonly iceFallbackTtlMs: number;
  readonly turnFetchTimeoutMs: number;
  readonly stunUrls: readonly string[];
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

const HOUR_MS = 60 * 60 * 1000;

export function loadConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const keyId = env.CLOUDFLARE_TURN_KEY_ID?.trim();
  const apiToken = env.CLOUDFLARE_TURN_KEY_SECRET?.trim();
  const turn: TurnCredentials | null = keyId && apiToken ? { keyId, apiToken } : null;

  return {
    port: parsePort(env.PORT),
    logLevel: parseLogLevel(env.LOG_LEVEL),
    turn,
    turnCredentialTtlSeconds: 86_400,
    iceCacheTtlMs: 12 * HOUR_MS,
    iceFallbackTtlMs: 60 * 1000,
    turnFetchTimeoutMs: 4_000,
    stunUrls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'],
  };
}

function parsePort(raw: string | undefined): number {
  if (!raw) return 8080;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new ConfigError(`Invalid PORT: "${raw}" (expected an integer 1-65535)`);
  }
  return port;
}

function parseLogLevel(raw: string | undefined): LogLevel {
  if (!raw) return 'info';
  const level = raw.toLowerCase();
  if (!LOG_LEVELS.includes(level as LogLevel)) {
    throw new ConfigError(`Invalid LOG_LEVEL: "${raw}" (expected one of ${LOG_LEVELS.join(', ')})`);
  }
  return level as LogLevel;
}
