import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DATABASE_FILE_LOCK_TIMING } from './file-lock.ts';
import {
  JsonFileDatabase,
  type JsonDatabaseRuntimeSchema,
} from './json-file-database.ts';
import type { JsonDatabaseDocument } from './json-file-database.types.ts';

interface CounterCollections {
  counters: { id: string; value: number }[];
}

const parseDocument = (
  input: unknown,
): JsonDatabaseDocument<CounterCollections> => {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('metadata' in input) ||
    !('collections' in input)
  ) {
    throw new Error('invalid document');
  }
  return input as JsonDatabaseDocument<CounterCollections>;
};

const schema: JsonDatabaseRuntimeSchema<CounterCollections> = {
  schemaVersion: 1,
  parse: parseDocument,
};

const waitForMessage = (
  child: ChildProcess,
  expectedType: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    let standardError = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      standardError += chunk.toString('utf8');
    });
    const onMessage = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === expectedType
      ) {
        cleanup();
        resolve();
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(
        new Error(
          `worker exited before ${expectedType} with ${code}: ${standardError}`,
        ),
      );
    };
    const cleanup = () => {
      child.off('message', onMessage);
      child.off('error', onError);
      child.off('exit', onExit);
    };

    child.on('message', onMessage);
    child.on('error', onError);
    child.on('exit', onExit);
  });

const stopChild = async (child: ChildProcess | undefined): Promise<void> => {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
};

describe('JsonFileDatabase stale lock recovery', () => {
  it('recovers a real lock abandoned by a forcefully terminated process', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'json-stale-lock-test-'),
    );
    const filePath = path.join(directory, 'database.json');
    const database = new JsonFileDatabase({ filePath, schema });
    await database.initialize({
      metadata: { schemaVersion: 1 },
      collections: { counters: [{ id: 'shared', value: 0 }] },
    });

    const holderPath = fileURLToPath(
      new URL('./stale-lock-holder.mjs', import.meta.url),
    );
    const workerPath = fileURLToPath(
      new URL('./cross-process-worker.mjs', import.meta.url),
    );
    let holder: ChildProcess | undefined;
    let worker: ChildProcess | undefined;

    try {
      holder = fork(holderPath, [filePath], {
        execArgv: ['--import', 'tsx'],
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      await waitForMessage(holder, 'locked');
      await stopChild(holder);

      const acquisitionStartedAt = Date.now();
      worker = fork(workerPath, [filePath, '1'], {
        execArgv: ['--import', 'tsx'],
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      await waitForMessage(worker, 'ready');
      const done = waitForMessage(worker, 'done');
      worker.send({ type: 'start' });
      await done;
      expect(Date.now() - acquisitionStartedAt).toBeLessThan(
        DATABASE_FILE_LOCK_TIMING.acquisitionTimeoutMilliseconds + 2_000,
      );
      worker.disconnect();

      const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
      expect(parseDocument(parsed).collections.counters).toEqual([
        { id: 'shared', value: 1 },
      ]);

      const reopened = new JsonFileDatabase({ filePath, schema });
      await expect(
        reopened.updateWhere(
          'counters',
          (counter) => counter.id === 'shared',
          (counter) => ({ ...counter, value: counter.value + 1 }),
        ),
      ).resolves.toEqual({
        matchedCount: 1,
        updatedRecords: [{ id: 'shared', value: 2 }],
      });
    } finally {
      await Promise.all([stopChild(holder), stopChild(worker)]);
      await rm(directory, { recursive: true, force: true });
    }
  }, 20_000);
});
