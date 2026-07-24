import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { KeyedMutex } from './keyed-mutex.ts';

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe('KeyedMutex', () => {
  it('serializes concurrent work for the same normalized absolute path', async () => {
    const mutex = new KeyedMutex();
    const firstMayFinish = deferred();
    const firstStarted = deferred();
    const secondStarted = deferred();
    const events: string[] = [];

    const first = mutex.runExclusive('data/../data/database.json', async () => {
      events.push('first-start');
      firstStarted.resolve();
      await firstMayFinish.promise;
      events.push('first-finish');
    });
    await firstStarted.promise;

    const second = mutex.runExclusive(
      path.resolve('data/database.json'),
      async () => {
        events.push('second-start');
        secondStarted.resolve();
      },
    );

    await Promise.resolve();
    expect(events).toEqual(['first-start']);

    firstMayFinish.resolve();
    await Promise.all([first, second, secondStarted.promise]);

    expect(events).toEqual(['first-start', 'first-finish', 'second-start']);
  });

  it('does not block work for different database paths', async () => {
    const mutex = new KeyedMutex();
    const firstMayFinish = deferred();
    const firstStarted = deferred();
    const secondStarted = deferred();

    const first = mutex.runExclusive('first.json', async () => {
      firstStarted.resolve();
      await firstMayFinish.promise;
    });
    await firstStarted.promise;

    const second = mutex.runExclusive('second.json', async () => {
      secondStarted.resolve();
    });

    await secondStarted.promise;
    firstMayFinish.resolve();
    await Promise.all([first, second]);
  });

  it('releases the queue after work throws', async () => {
    const mutex = new KeyedMutex();
    const failure = new Error('mutation failed');

    await expect(
      mutex.runExclusive('database.json', () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    await expect(
      mutex.runExclusive('database.json', () => 'recovered'),
    ).resolves.toBe('recovered');
  });

  it('removes the in-memory entry after all work completes', async () => {
    const mutex = new KeyedMutex();

    await mutex.runExclusive('database.json', () => undefined);

    expect(mutex.activeKeyCount).toBe(0);
  });
});
