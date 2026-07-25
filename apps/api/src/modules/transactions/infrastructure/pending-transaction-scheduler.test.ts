import { describe, expect, it } from 'vitest';

import type {
  LogBindings,
  Logger,
} from '../../../shared/observability/logger.ts';
import { PendingTransactionScheduler } from './pending-transaction-scheduler.ts';

const recordingLogger = () => {
  const entries: Array<{
    level: 'info' | 'error';
    bindings: LogBindings;
  }> = [];
  const logger: Logger = {
    debug: () => undefined,
    info: (bindings) => entries.push({ level: 'info', bindings }),
    warn: () => undefined,
    error: (bindings) => entries.push({ level: 'error', bindings }),
    child: () => logger,
  };
  return { entries, logger };
};

describe('PendingTransactionScheduler', () => {
  it('uses one five-second task and skips overlapping executions', async () => {
    const { entries, logger } = recordingLogger();
    let callback: (() => Promise<void> | void) | undefined;
    let starts = 0;
    let stops = 0;
    let executions = 0;
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const scheduler = new PendingTransactionScheduler(
      {
        execute: async () => {
          executions += 1;
          await blocked;
          return { postedCount: 2 };
        },
      },
      logger,
      (expression, handler) => {
        expect(expression).toBe('*/5 * * * * *');
        callback = handler;
        return {
          start: () => {
            starts += 1;
          },
          stop: () => {
            stops += 1;
          },
        };
      },
    );

    scheduler.start();
    scheduler.start();
    const first = callback?.();
    await callback?.();
    expect(executions).toBe(1);
    release?.();
    await first;
    scheduler.stop();

    expect(starts).toBe(1);
    expect(stops).toBe(1);
    expect(entries).toContainEqual({
      level: 'info',
      bindings: {
        component: 'pending-transaction-scheduler',
        event: 'scheduler_started',
      },
    });
    expect(entries).toContainEqual({
      level: 'info',
      bindings: {
        component: 'pending-transaction-scheduler',
        event: 'transactions_posted',
        postedCount: 2,
      },
    });
  });

  it('logs reconciliation failures safely', async () => {
    const { entries, logger } = recordingLogger();
    const scheduler = new PendingTransactionScheduler(
      {
        execute: async () => {
          throw new TypeError('sensitive detail');
        },
      },
      logger,
      () => ({ start: () => undefined, stop: () => undefined }),
    );

    await scheduler.reconcile();

    expect(entries).toContainEqual({
      level: 'error',
      bindings: {
        component: 'pending-transaction-scheduler',
        event: 'scheduler_failed',
        err: { type: 'TypeError' },
      },
    });
    expect(JSON.stringify(entries)).not.toContain('sensitive detail');
  });
});
