import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import type { LogBindings, Logger } from './shared/observability/logger.ts';
import { startApiServer } from './server-runtime.ts';

interface LogEntry {
  readonly level: 'info' | 'error';
  readonly bindings: LogBindings;
}

const recordingLogger = () => {
  const entries: LogEntry[] = [];
  const logger: Logger = {
    debug: () => undefined,
    info: (bindings) => entries.push({ level: 'info', bindings }),
    warn: () => undefined,
    error: (bindings) => entries.push({ level: 'error', bindings }),
    child: () => logger,
  };
  return { entries, logger };
};

describe('startApiServer', () => {
  it('logs a bootstrap failure and sets the process exit code', async () => {
    const { entries, logger } = recordingLogger();
    const processState = { exitCode: undefined as number | undefined };

    await startApiServer({
      logger,
      port: 3000,
      processState,
      createRuntime: async () => {
        throw new TypeError('sensitive bootstrap detail');
      },
    });

    expect(processState.exitCode).toBe(1);
    expect(entries).toEqual([
      {
        level: 'error',
        bindings: {
          component: 'server',
          phase: 'bootstrap',
          err: { type: 'TypeError' },
        },
      },
    ]);
  });

  it('logs listener success and failure and sets the process exit code', async () => {
    const { entries, logger } = recordingLogger();
    const processState = { exitCode: undefined as number | undefined };
    const server = new EventEmitter();
    let onListening: (() => void) | undefined;

    await startApiServer({
      logger,
      port: 4321,
      processState,
      createRuntime: async () => ({
        scheduler: {
          reconcile: async () => undefined,
          start: () => undefined,
          stop: () => undefined,
        },
        app: {
          listen: (_port: number, callback: () => void) => {
            onListening = callback;
            return server;
          },
        },
      }),
    });

    onListening?.();
    server.emit('error', new Error('address contains sensitive detail'));

    expect(processState.exitCode).toBe(1);
    expect(entries).toEqual([
      {
        level: 'info',
        bindings: { component: 'server', phase: 'listener', port: 4321 },
      },
      {
        level: 'error',
        bindings: {
          component: 'server',
          phase: 'listener',
          port: 4321,
          err: { type: 'Error' },
        },
      },
    ]);
  });

  it('runs startup catch-up, starts once, and shuts down the scheduler and server', async () => {
    const { entries, logger } = recordingLogger();
    const processState = { exitCode: undefined as number | undefined };
    const signals = new EventEmitter();
    const server = new EventEmitter() as EventEmitter & {
      close(callback: (error?: Error) => void): void;
    };
    let closed = 0;
    server.close = (callback) => {
      closed += 1;
      callback();
    };
    const lifecycle: string[] = [];

    await startApiServer({
      logger,
      port: 3000,
      processState,
      signalSource: signals,
      createRuntime: async () => ({
        scheduler: {
          reconcile: async () => {
            lifecycle.push('reconcile');
          },
          start: () => {
            lifecycle.push('start');
          },
          stop: () => {
            lifecycle.push('stop');
          },
        },
        app: {
          listen: (_port: number, callback: () => void) => {
            callback();
            return server;
          },
        },
      }),
    });
    signals.emit('SIGTERM');

    expect(lifecycle).toEqual(['reconcile', 'start', 'stop']);
    expect(closed).toBe(1);
    expect(processState.exitCode).toBeUndefined();
    expect(entries).toContainEqual({
      level: 'info',
      bindings: { component: 'server', phase: 'shutdown' },
    });
  });
});
