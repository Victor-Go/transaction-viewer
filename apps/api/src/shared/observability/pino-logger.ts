import pino, { type DestinationStream, type Logger as PinoLogger } from 'pino';

import type { LogBindings, Logger } from './logger.ts';

export interface PinoLoggerOptions {
  readonly level?: string;
  readonly environment?: string;
  readonly destination?: DestinationStream;
}

class PinoLoggerAdapter implements Logger {
  constructor(private readonly logger: PinoLogger) {}

  debug(bindings: LogBindings, message?: string): void {
    this.logger.debug(bindings, message);
  }
  info(bindings: LogBindings, message?: string): void {
    this.logger.info(bindings, message);
  }
  warn(bindings: LogBindings, message?: string): void {
    this.logger.warn(bindings, message);
  }
  error(bindings: LogBindings, message?: string): void {
    this.logger.error(bindings, message);
  }
  child(bindings: LogBindings): Logger {
    return new PinoLoggerAdapter(this.logger.child(bindings));
  }
}

export const createPinoLogger = ({
  level = 'info',
  environment,
  destination,
}: PinoLoggerOptions = {}): Logger => {
  const options = {
    level,
    base: {
      service: 'card-platform-api',
      ...(environment === undefined ? {} : { environment }),
    },
    redact: {
      paths: [
        'authorization',
        'cookie',
        'headers.authorization',
        'headers.cookie',
        'password',
        '*.password',
        'token',
        '*.token',
        'pageToken',
        '*.pageToken',
        'nextPageToken',
        '*.nextPageToken',
        'accessToken',
        '*.accessToken',
        'refreshToken',
        '*.refreshToken',
        'idempotencyKey',
        '*.idempotencyKey',
        "['idempotency-key']",
        "headers['idempotency-key']",
        "req.headers['idempotency-key']",
        "request.headers['idempotency-key']",
        'req.query.pageToken',
        'req.body.pageToken',
        'request.query.pageToken',
        'request.body.pageToken',
        'databaseUrl',
        'connectionString',
      ],
      censor: '[Redacted]',
    },
  };
  const logger =
    destination === undefined ? pino(options) : pino(options, destination);
  return new PinoLoggerAdapter(logger);
};
