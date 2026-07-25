import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { LogBindings, Logger } from '../../observability/logger.ts';
import { JsonFileDatabase } from './json-file-database.ts';

interface Collections {
  records: readonly { readonly id: string }[];
}

const schema = {
  schemaVersion: 1,
  parse(input: unknown) {
    if (
      typeof input !== 'object' ||
      input === null ||
      !('collections' in input) ||
      typeof input.collections !== 'object' ||
      input.collections === null ||
      !('records' in input.collections)
    ) {
      throw new Error('invalid document');
    }
    return input as {
      metadata: { schemaVersion: number };
      collections: Collections;
    };
  },
};

let directory: string | undefined;

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

describe('JsonFileDatabase logging', () => {
  it('logs a failed read with child context without logging document contents', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'json-logging-'));
    const filePath = path.join(directory, 'secret-database.json');
    await writeFile(filePath, '{"transactions":"sensitive-record"}');
    const entries: Array<{
      level: string;
      bindings: LogBindings;
      message?: string;
    }> = [];
    const createLogger = (context: LogBindings): Logger => ({
      debug: (bindings, message) =>
        entries.push({
          level: 'debug',
          bindings: { ...context, ...bindings },
          ...(message === undefined ? {} : { message }),
        }),
      info: (bindings, message) =>
        entries.push({
          level: 'info',
          bindings: { ...context, ...bindings },
          ...(message === undefined ? {} : { message }),
        }),
      warn: (bindings, message) =>
        entries.push({
          level: 'warn',
          bindings: { ...context, ...bindings },
          ...(message === undefined ? {} : { message }),
        }),
      error: (bindings, message) =>
        entries.push({
          level: 'error',
          bindings: { ...context, ...bindings },
          ...(message === undefined ? {} : { message }),
        }),
      child: (bindings) => createLogger({ ...context, ...bindings }),
    });
    const database = new JsonFileDatabase({
      filePath,
      schema,
      logger: createLogger({}),
    });

    await expect(database.find('records')).rejects.toThrow();
    expect(entries.some(({ level }) => level === 'error')).toBe(true);
    expect(entries[0]?.bindings).toMatchObject({
      component: 'json-file-database',
      database: 'secret-database.json',
    });
    expect(JSON.stringify(entries)).not.toContain('sensitive-record');
    expect(JSON.stringify(entries)).not.toContain(directory);
  });
});
