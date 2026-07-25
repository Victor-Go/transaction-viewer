import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createPinoLogger } from './pino-logger.ts';

describe('Pino logger adapter', () => {
  it('writes structured child context and redacts likely secrets', () => {
    const lines: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = createPinoLogger({
      level: 'debug',
      environment: 'test',
      destination,
    });

    logger.child({ component: 'test-component' }).error(
      {
        password: 'secret',
        pageToken: 'opaque-page-token',
        idempotencyKey: 'raw-idempotency-key',
        request: {
          query: { pageToken: 'nested-page-token' },
          headers: { 'idempotency-key': 'nested-idempotency-key' },
        },
        err: { type: 'TestError' },
      },
      'failed',
    );

    const entry = JSON.parse(lines.join(''));
    expect(entry).toMatchObject({
      level: 50,
      service: 'card-platform-api',
      environment: 'test',
      component: 'test-component',
      password: '[Redacted]',
      pageToken: '[Redacted]',
      idempotencyKey: '[Redacted]',
      request: {
        query: { pageToken: '[Redacted]' },
        headers: { 'idempotency-key': '[Redacted]' },
      },
      msg: 'failed',
    });
  });
});
