import { fork, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

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

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

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

describe('JsonFileDatabase cross-process locking', () => {
  it('prevents lost updates across two real Node.js processes', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'json-cross-process-test-'),
    );
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, 'database.json');
    const database = new JsonFileDatabase({ filePath, schema });
    await database.initialize({
      metadata: { schemaVersion: 1 },
      collections: { counters: [{ id: 'shared', value: 0 }] },
    });

    const workerPath = fileURLToPath(
      new URL('./cross-process-worker.mjs', import.meta.url),
    );
    const iterations = 30;
    const createWorker = () =>
      fork(workerPath, [filePath, String(iterations)], {
        execArgv: ['--import', 'tsx'],
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
    const first = createWorker();
    const second = createWorker();

    await Promise.all([
      waitForMessage(first, 'ready'),
      waitForMessage(second, 'ready'),
    ]);
    const firstDone = waitForMessage(first, 'done');
    const secondDone = waitForMessage(second, 'done');
    first.send({ type: 'start' });
    second.send({ type: 'start' });
    await Promise.all([firstDone, secondDone]);
    first.disconnect();
    second.disconnect();

    const rawDocument: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    expect(parseDocument(rawDocument).collections.counters).toEqual([
      { id: 'shared', value: iterations * 2 },
    ]);

    const reopened = new JsonFileDatabase({ filePath, schema });
    await expect(
      reopened.findOne('counters', (counter) => counter.id === 'shared'),
    ).resolves.toEqual({ id: 'shared', value: iterations * 2 });
    await expect(
      reopened.updateWhere(
        'counters',
        () => false,
        (counter) => counter,
      ),
    ).resolves.toEqual({ matchedCount: 0, updatedRecords: [] });
  }, 30_000);
});
