/**
 * Minimal structured logger. Emits one JSON object per line (the format every
 * log aggregator understands) and supports child loggers that carry bound
 * context. The sink and clock are injectable so tests can silence or capture
 * output deterministically.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface ConsoleLoggerOptions {
  readonly level?: LogLevel;
  readonly context?: Record<string, unknown>;
  readonly sink?: (line: string) => void;
  readonly clock?: () => Date;
}

export class ConsoleLogger implements Logger {
  private readonly level: LogLevel;
  private readonly context: Record<string, unknown>;
  private readonly sink: (line: string) => void;
  private readonly clock: () => Date;

  constructor(options: ConsoleLoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.context = options.context ?? {};
    this.sink = options.sink ?? ((line) => void process.stdout.write(`${line}\n`));
    this.clock = options.clock ?? (() => new Date());
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.write('debug', message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.write('info', message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.write('warn', message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.write('error', message, fields);
  }

  child(context: Record<string, unknown>): Logger {
    return new ConsoleLogger({
      level: this.level,
      context: { ...this.context, ...context },
      sink: this.sink,
      clock: this.clock,
    });
  }

  private write(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.level]) return;
    const entry = { time: this.clock().toISOString(), level, message, ...this.context, ...fields };
    this.sink(JSON.stringify(entry));
  }
}
