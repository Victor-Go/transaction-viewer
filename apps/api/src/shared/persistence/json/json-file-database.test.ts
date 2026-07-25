import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOOP_LOGGER } from '../../observability/logger.ts';

import { AtomicFileWriter } from './atomic-file-writer.ts';
import type { FileLock } from './file-lock.ts';
import {
  AsyncTransactionCallbackError,
  DatabaseFileMissingError,
  InvalidDatabaseDocumentError,
  MalformedDatabaseJsonError,
  DatabaseReadError,
  DatabaseSerializationError,
  DatabaseSizeLimitExceededError,
  DatabaseSymlinkNotAllowedError,
  UnsupportedDatabaseSchemaVersionError,
} from './json-file-database.errors.ts';
import {
  JsonFileDatabase,
  MAX_DATABASE_FILE_BYTES,
  type JsonDatabaseRuntimeSchema,
} from './json-file-database.ts';
import type { JsonDatabaseDocument } from './json-file-database.types.ts';

interface TestRecord {
  id: string;
  value: number;
  active: boolean;
  payload?: string;
}

interface TestCollections {
  records: TestRecord[];
}

type TestDocument = JsonDatabaseDocument<TestCollections>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseTestDocument = (input: unknown): TestDocument => {
  if (!isObject(input) || !isObject(input.metadata)) {
    throw new Error('document and metadata must be objects');
  }
  if (input.metadata.schemaVersion !== 1 || !isObject(input.collections)) {
    throw new Error('invalid metadata or collections');
  }
  const records = input.collections.records;
  if (
    !Array.isArray(records) ||
    records.some(
      (record) =>
        !isObject(record) ||
        typeof record.id !== 'string' ||
        typeof record.value !== 'number' ||
        typeof record.active !== 'boolean' ||
        ('payload' in record &&
          record.payload !== undefined &&
          typeof record.payload !== 'string'),
    )
  ) {
    throw new Error('invalid records collection');
  }

  return input as unknown as TestDocument;
};

const schema: JsonDatabaseRuntimeSchema<TestCollections> = {
  schemaVersion: 1,
  parse: parseTestDocument,
};

const emptyDocument = (): TestDocument => ({
  metadata: { schemaVersion: 1 },
  collections: { records: [] },
});

const initialRecord: TestRecord = {
  id: 'record-1',
  value: 1,
  active: true,
};

let directory: string;
let filePath: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'json-database-test-'));
  filePath = path.join(directory, 'database.json');
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const createDatabase = (): JsonFileDatabase<TestCollections> =>
  new JsonFileDatabase({ filePath, schema, logger: NOOP_LOGGER });

const initializeWithRecord = async (): Promise<
  JsonFileDatabase<TestCollections>
> => {
  const database = createDatabase();
  await database.initialize({
    metadata: { schemaVersion: 1 },
    collections: { records: [initialRecord] },
  });
  return database;
};

const temporaryFiles = async (): Promise<string[]> =>
  (await readdir(directory)).filter(
    (entry) => entry.startsWith('database.json.') && entry.endsWith('.tmp'),
  );

const pathForAssertion = async (targetPath: string): Promise<string> =>
  path.join(
    await realpath(path.dirname(targetPath)),
    path.basename(targetPath),
  );

const releaseFailingFileLock = (release: () => Promise<void>): FileLock => ({
  acquire: async () => ({
    assertUsable: () => undefined,
    release,
  }),
});

class BlockingAtomicFileWriter extends AtomicFileWriter {
  readonly started: Promise<void>;
  #markStarted!: () => void;
  #continue!: () => void;
  readonly #continuation: Promise<void>;

  constructor() {
    super();
    this.started = new Promise((resolve) => {
      this.#markStarted = resolve;
    });
    this.#continuation = new Promise((resolve) => {
      this.#continue = resolve;
    });
  }

  continue(): void {
    this.#continue();
  }

  override async replace(
    targetPath: string,
    contents: string,
    beforeRename?: () => void,
  ): Promise<void> {
    this.#markStarted();
    await this.#continuation;
    await super.replace(targetPath, contents, beforeRename);
  }
}

describe('JsonFileDatabase initialization and reads', () => {
  it('explicitly initializes a valid complete document', async () => {
    const database = createDatabase();

    const result = await database.initialize(emptyDocument());

    expect(result).toEqual({ created: true });
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual(
      emptyDocument(),
    );
  });

  it('does not overwrite committed data during concurrent initialization', async () => {
    const first = createDatabase();
    const second = createDatabase();
    const competingRecord = { ...initialRecord, id: 'record-2' };

    const results = await Promise.all([
      first.initialize({
        metadata: { schemaVersion: 1 },
        collections: { records: [initialRecord] },
      }),
      second.initialize({
        metadata: { schemaVersion: 1 },
        collections: { records: [competingRecord] },
      }),
    ]);
    const records = await createDatabase().find('records');

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(records).toHaveLength(1);
    expect([initialRecord, competingRecord]).toContainEqual(records[0]);
  });

  it('finds matching records and returns an empty array when none match', async () => {
    const database = await initializeWithRecord();
    await database.insert('records', {
      id: 'record-2',
      value: 2,
      active: false,
    });

    await expect(
      database.find('records', (record) => record.active),
    ).resolves.toEqual([initialRecord]);
    await expect(
      database.find('records', (record) => record.value > 100),
    ).resolves.toEqual([]);
  });

  it('findOne returns one record or null', async () => {
    const database = await initializeWithRecord();

    await expect(
      database.findOne('records', (record) => record.id === initialRecord.id),
    ).resolves.toEqual(initialRecord);
    await expect(
      database.findOne('records', (record) => record.id === 'missing'),
    ).resolves.toBeNull();
  });

  it('returns defensive copies that cannot mutate committed state', async () => {
    const database = await initializeWithRecord();
    const found = await database.find('records');
    const foundOne = await database.findOne(
      'records',
      (record) => record.id === initialRecord.id,
    );

    found[0]!.value = 999;
    foundOne!.value = 888;

    await expect(database.find('records')).resolves.toEqual([initialRecord]);
  });

  it('rejects a missing file when initialization was not requested', async () => {
    await expect(createDatabase().find('records')).rejects.toBeInstanceOf(
      DatabaseFileMissingError,
    );
  });

  it('rejects malformed JSON', async () => {
    await writeFile(filePath, '{"metadata":', 'utf8');

    await expect(createDatabase().find('records')).rejects.toBeInstanceOf(
      MalformedDatabaseJsonError,
    );
  });

  it('classifies an unreadable directory target as a read failure', async () => {
    filePath = path.join(directory, 'database-directory');
    await mkdir(filePath);

    await expect(createDatabase().find('records')).rejects.toBeInstanceOf(
      DatabaseReadError,
    );
  });

  it('classifies a schema-invalid document as invalid', async () => {
    await writeFile(
      filePath,
      JSON.stringify({
        metadata: { schemaVersion: 1 },
        collections: { records: [{ invalid: true }] },
      }),
      'utf8',
    );

    await expect(createDatabase().find('records')).rejects.toBeInstanceOf(
      InvalidDatabaseDocumentError,
    );
  });

  it('rejects an unsupported schema version before accepting data', async () => {
    await writeFile(
      filePath,
      JSON.stringify({
        metadata: { schemaVersion: 2 },
        collections: { records: [] },
      }),
      'utf8',
    );

    await expect(createDatabase().find('records')).rejects.toBeInstanceOf(
      UnsupportedDatabaseSchemaVersionError,
    );
  });

  it('reads an existing database below the 1 MiB limit', async () => {
    await writeFile(filePath, `${JSON.stringify(emptyDocument())}\n`, 'utf8');

    await expect(createDatabase().find('records')).resolves.toEqual([]);
  });

  it('rejects an oversized file before attempting normal JSON parsing', async () => {
    await writeFile(filePath, 'not-json'.padEnd(MAX_DATABASE_FILE_BYTES + 1));

    const read = createDatabase().find('records');

    await expect(read).rejects.toBeInstanceOf(DatabaseSizeLimitExceededError);
    await expect(read).rejects.not.toBeInstanceOf(MalformedDatabaseJsonError);
  });
});

describe('JsonFileDatabase mutations', () => {
  it('inserts exactly one record and returns a defensive copy', async () => {
    const database = createDatabase();
    await database.initialize(emptyDocument());
    const record = { ...initialRecord };

    const inserted = await database.insert('records', record);
    record.value = 77;
    inserted.value = 88;

    await expect(database.find('records')).resolves.toEqual([initialRecord]);
  });

  it('updates every matching record atomically and returns useful results', async () => {
    const database = await initializeWithRecord();
    await database.insert('records', {
      id: 'record-2',
      value: 2,
      active: true,
    });
    await database.insert('records', {
      id: 'record-3',
      value: 3,
      active: false,
    });

    const result = await database.updateWhere(
      'records',
      (record) => record.active,
      (record) => ({ ...record, value: record.value + 10 }),
    );
    result.updatedRecords[0]!.value = 999;

    expect(result.matchedCount).toBe(2);
    expect(result.updatedRecords.map((record) => record.value)).toEqual([
      999, 12,
    ]);
    await expect(database.find('records')).resolves.toEqual([
      { ...initialRecord, value: 11 },
      { id: 'record-2', value: 12, active: true },
      { id: 'record-3', value: 3, active: false },
    ]);
  });

  it('does not rewrite the file when updateWhere matches nothing', async () => {
    const database = await initializeWithRecord();
    const oldTimestamp = new Date('2000-01-01T00:00:00.000Z');
    await utimes(filePath, oldTimestamp, oldTimestamp);

    const result = await database.updateWhere(
      'records',
      () => false,
      (record) => ({ ...record, value: 100 }),
    );

    expect(result).toEqual({ matchedCount: 0, updatedRecords: [] });
    expect((await stat(filePath)).mtimeMs).toBe(oldTimestamp.getTime());
  });

  it('returns the committed result when lock release fails after replacement', async () => {
    await createDatabase().initialize(emptyDocument());
    const release = vi.fn(async () => {
      throw new Error('unlock failed');
    });
    const database = new JsonFileDatabase({
      filePath,
      schema,
      logger: NOOP_LOGGER,
      fileLock: releaseFailingFileLock(release),
    });
    let callbackExecutions = 0;

    const result = await database.transaction((transaction) => {
      callbackExecutions += 1;
      return transaction.insert('records', initialRecord);
    });

    expect(result).toEqual(initialRecord);
    expect(callbackExecutions).toBe(1);
    expect(release).toHaveBeenCalledOnce();
    await expect(createDatabase().find('records')).resolves.toEqual([
      initialRecord,
    ]);
    await expect(
      createDatabase().insert('records', {
        id: 'after-unlock-failure',
        value: 2,
        active: true,
      }),
    ).resolves.toMatchObject({ id: 'after-unlock-failure' });
  });

  it('preserves the original callback error when lock release also fails', async () => {
    await createDatabase().initialize(emptyDocument());
    const originalFailure = new Error('original callback failure');
    const database = new JsonFileDatabase({
      filePath,
      schema,
      logger: NOOP_LOGGER,
      fileLock: releaseFailingFileLock(async () => {
        throw new Error('unlock failed');
      }),
    });

    await expect(
      database.transaction(() => {
        throw originalFailure;
      }),
    ).rejects.toBe(originalFailure);
  });

  it('returns a successful no-op result when lock release fails', async () => {
    const initialized = await initializeWithRecord();
    const release = vi.fn(async () => {
      throw new Error('unlock failed');
    });
    const database = new JsonFileDatabase({
      filePath,
      schema,
      logger: NOOP_LOGGER,
      fileLock: releaseFailingFileLock(release),
    });

    const result = await database.updateWhere(
      'records',
      () => false,
      (record) => record,
    );

    expect(result).toEqual({ matchedCount: 0, updatedRecords: [] });
    expect(release).toHaveBeenCalledOnce();
    await expect(initialized.find('records')).resolves.toEqual([initialRecord]);
  });

  it('rolls back and rethrows when the synchronous callback fails', async () => {
    const database = await initializeWithRecord();
    const originalContents = await readFile(filePath, 'utf8');
    const failure = new Error('mutation failed');

    await expect(
      database.transaction((transaction) => {
        transaction.insert('records', {
          id: 'uncommitted',
          value: 2,
          active: true,
        });
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await readFile(filePath, 'utf8')).toBe(originalContents);
    await expect(
      database.insert('records', {
        id: 'after-failure',
        value: 3,
        active: true,
      }),
    ).resolves.toEqual({
      id: 'after-failure',
      value: 3,
      active: true,
    });
  });

  it('rejects async callbacks without committing their working copy', async () => {
    const database = await initializeWithRecord();
    const originalContents = await readFile(filePath, 'utf8');

    await expect(
      // @ts-expect-error Async callbacks are rejected by the public type signature.
      database.transaction(async (transaction) => {
        transaction.insert('records', {
          id: 'uncommitted',
          value: 2,
          active: true,
        });
      }),
    ).rejects.toBeInstanceOf(AsyncTransactionCallbackError);

    expect(await readFile(filePath, 'utf8')).toBe(originalContents);
    await expect(
      database.insert('records', {
        id: 'after-async-rejection',
        value: 3,
        active: true,
      }),
    ).resolves.toMatchObject({ id: 'after-async-rejection' });
  });

  it('consumes a later rejection from an invalid async callback', async () => {
    const database = await initializeWithRecord();
    let rejectLater!: () => void;
    const later = new Promise<void>((_resolve, reject) => {
      rejectLater = () => reject(new Error('later async failure'));
    });
    const unhandled: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      await expect(
        // @ts-expect-error Async callbacks are rejected by the public type signature.
        database.transaction(async () => {
          await later;
        }),
      ).rejects.toBeInstanceOf(AsyncTransactionCallbackError);

      rejectLater();
      await new Promise<void>((resolve) => setImmediate(resolve));
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });

  it('leaves the original file unchanged when resulting validation fails', async () => {
    const database = await initializeWithRecord();
    const originalContents = await readFile(filePath, 'utf8');

    await expect(
      database.updateWhere(
        'records',
        () => true,
        (record) => ({
          ...record,
          value: 'invalid' as unknown as number,
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidDatabaseDocumentError);

    expect(await readFile(filePath, 'utf8')).toBe(originalContents);
    expect(await temporaryFiles()).toEqual([]);
  });

  it('persists a successful mutation for a fresh database instance', async () => {
    const database = createDatabase();
    await database.initialize(emptyDocument());
    await database.insert('records', initialRecord);

    await expect(createDatabase().find('records')).resolves.toEqual([
      initialRecord,
    ]);
    expect(await temporaryFiles()).toEqual([]);
  });

  it.each([
    ['NaN', Number.NaN],
    ['positive Infinity', Number.POSITIVE_INFINITY],
    ['negative Infinity', Number.NEGATIVE_INFINITY],
  ])('rejects %s without changing the committed file', async (_name, value) => {
    const database = await initializeWithRecord();
    const originalContents = await readFile(filePath);

    await expect(
      database.insert('records', {
        id: 'unsafe-number',
        value,
        active: true,
      }),
    ).rejects.toBeInstanceOf(DatabaseSerializationError);

    expect(await readFile(filePath)).toEqual(originalContents);
    await expect(createDatabase().find('records')).resolves.toEqual([
      initialRecord,
    ]);
    expect(await temporaryFiles()).toEqual([]);
  });

  it('rejects an undefined object property instead of silently removing it', async () => {
    const database = await initializeWithRecord();
    const originalContents = await readFile(filePath);
    const record = {
      id: 'undefined-property',
      value: 2,
      active: true,
      silentlyRemoved: undefined,
    } as unknown as TestRecord;

    await expect(database.insert('records', record)).rejects.toBeInstanceOf(
      DatabaseSerializationError,
    );

    expect(await readFile(filePath)).toEqual(originalContents);
    await expect(createDatabase().find('records')).resolves.toEqual([
      initialRecord,
    ]);
    expect(await temporaryFiles()).toEqual([]);
  });

  it.each([
    ['bigint', () => 1n],
    ['symbol', () => Symbol('unsafe')],
    ['function', () => () => undefined],
    ['Date', () => new Date('2026-01-01T00:00:00.000Z')],
    [
      'class instance',
      () =>
        new (class UnsafeRecordValue {
          readonly value = 'unsafe';
        })(),
    ],
    [
      'cyclic object',
      () => {
        const cyclic: { self?: unknown } = {};
        cyclic.self = cyclic;
        return cyclic;
      },
    ],
  ])('rejects a non-JSON-safe %s value', async (_name, createUnsafeValue) => {
    const database = await initializeWithRecord();
    const originalContents = await readFile(filePath);
    const record = {
      id: 'unsafe-value',
      value: 2,
      active: true,
      unsafe: createUnsafeValue(),
    } as unknown as TestRecord;

    await expect(database.insert('records', record)).rejects.toBeInstanceOf(
      DatabaseSerializationError,
    );

    expect(await readFile(filePath)).toEqual(originalContents);
    expect(await temporaryFiles()).toEqual([]);
  });

  it('rejects a JSON round-trip mismatch without replacing the file', async () => {
    const database = await initializeWithRecord();
    const originalContents = await readFile(filePath);

    await expect(
      database.insert('records', {
        id: 'negative-zero',
        value: -0,
        active: true,
      }),
    ).rejects.toBeInstanceOf(DatabaseSerializationError);

    expect(await readFile(filePath)).toEqual(originalContents);
    expect(await temporaryFiles()).toEqual([]);
  });

  it('commits a JSON-safe document that remains equivalent after round-trip', async () => {
    const database = await initializeWithRecord();
    const inserted = {
      id: 'json-safe',
      value: 42,
      active: false,
      payload: 'safe text',
    };

    await expect(database.insert('records', inserted)).resolves.toEqual(
      inserted,
    );

    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    expect(parseTestDocument(parsed).collections.records).toEqual([
      initialRecord,
      inserted,
    ]);
  });

  it('allows a mutation whose UTF-8 serialized result remains below 1 MiB', async () => {
    const database = await initializeWithRecord();

    await expect(
      database.insert('records', {
        id: 'small-unicode',
        value: 2,
        active: true,
        payload: 'é'.repeat(1_000),
      }),
    ).resolves.toMatchObject({ id: 'small-unicode' });

    expect((await stat(filePath)).size).toBeLessThan(MAX_DATABASE_FILE_BYTES);
  });

  it('rejects a mutation exceeding 1 MiB by UTF-8 bytes', async () => {
    const database = await initializeWithRecord();
    const originalContents = await readFile(filePath);
    const payload = 'é'.repeat(Math.ceil(MAX_DATABASE_FILE_BYTES / 2));
    expect(payload.length).toBeLessThan(MAX_DATABASE_FILE_BYTES);

    await expect(
      database.insert('records', {
        id: 'oversized-unicode',
        value: 2,
        active: true,
        payload,
      }),
    ).rejects.toBeInstanceOf(DatabaseSizeLimitExceededError);

    expect(await readFile(filePath)).toEqual(originalContents);
    expect(await temporaryFiles()).toEqual([]);
  });

  it('serializes same-process mutations without lost updates', async () => {
    const first = createDatabase();
    const second = createDatabase();
    await first.initialize(emptyDocument());
    const expectedIds = Array.from({ length: 40 }, (_, index) => `id-${index}`);

    await Promise.all(
      expectedIds.map((id, index) =>
        (index % 2 === 0 ? first : second).insert('records', {
          id,
          value: index,
          active: true,
        }),
      ),
    );

    const rawDocument: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    const records = parseTestDocument(rawDocument).collections.records;
    expect(records).toHaveLength(expectedIds.length);
    expect(records.map((record) => record.id).sort()).toEqual(
      expectedIds.sort(),
    );
  });
});

describe('JsonFileDatabase canonical path identity', () => {
  it('accepts a normal database file', async () => {
    const database = createDatabase();
    await database.initialize(emptyDocument());

    await expect(database.find('records')).resolves.toEqual([]);
  });

  it('rejects a target database file that is a symbolic link', async () => {
    const realTargetPath = path.join(
      directory,
      process.platform === 'win32'
        ? 'real-database-directory'
        : 'real-database.json',
    );
    if (process.platform === 'win32') {
      await mkdir(realTargetPath);
      await symlink(realTargetPath, filePath, 'junction');
    } else {
      await writeFile(
        realTargetPath,
        `${JSON.stringify(emptyDocument(), null, 2)}\n`,
        'utf8',
      );
      await symlink(realTargetPath, filePath, 'file');
    }
    const database = createDatabase();

    await expect(database.find('records')).rejects.toBeInstanceOf(
      DatabaseSymlinkNotAllowedError,
    );
  });

  it('serializes aliases of the same canonical parent with one mutex and lock target', async () => {
    const realDirectory = path.join(directory, 'real');
    const aliasDirectory = path.join(directory, 'alias');
    await mkdir(realDirectory);
    await symlink(
      realDirectory,
      aliasDirectory,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const realFilePath = path.join(realDirectory, 'shared.json');
    const aliasFilePath = path.join(aliasDirectory, 'shared.json');
    await new JsonFileDatabase({
      filePath: realFilePath,
      schema,
      logger: NOOP_LOGGER,
    }).initialize(emptyDocument());

    const acquiredTargets: string[] = [];
    const recordingLock: FileLock = {
      acquire: async (targetPath) => {
        acquiredTargets.push(targetPath);
        return {
          assertUsable: () => undefined,
          release: async () => undefined,
        };
      },
    };
    const blockingWriter = new BlockingAtomicFileWriter();
    const realDatabase = new JsonFileDatabase({
      filePath: realFilePath,
      schema,
      logger: NOOP_LOGGER,
      fileLock: recordingLock,
      atomicFileWriter: blockingWriter,
    });
    const aliasDatabase = new JsonFileDatabase({
      filePath: aliasFilePath,
      schema,
      logger: NOOP_LOGGER,
      fileLock: recordingLock,
    });

    const firstMutation = realDatabase.insert('records', {
      id: 'real',
      value: 1,
      active: true,
    });
    await blockingWriter.started;
    const secondMutation = aliasDatabase.insert('records', {
      id: 'alias',
      value: 2,
      active: true,
    });

    try {
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      expect(acquiredTargets).toEqual([await pathForAssertion(realFilePath)]);
    } finally {
      blockingWriter.continue();
    }

    await Promise.all([firstMutation, secondMutation]);
    expect(acquiredTargets).toEqual([
      await pathForAssertion(realFilePath),
      await pathForAssertion(realFilePath),
    ]);
    await expect(realDatabase.find('records')).resolves.toHaveLength(2);
  });

  it('does not block mutations for different canonical database files', async () => {
    const firstPath = path.join(directory, 'first.json');
    const secondPath = path.join(directory, 'second.json');
    await new JsonFileDatabase({
      filePath: firstPath,
      schema,
      logger: NOOP_LOGGER,
    }).initialize(emptyDocument());
    await new JsonFileDatabase({
      filePath: secondPath,
      schema,
      logger: NOOP_LOGGER,
    }).initialize(emptyDocument());

    let secondAcquired!: () => void;
    const secondAcquisition = new Promise<void>((resolve) => {
      secondAcquired = resolve;
    });
    const recordingLock: FileLock = {
      acquire: async (targetPath) => {
        if (path.basename(targetPath) === 'second.json') {
          secondAcquired();
        }
        return {
          assertUsable: () => undefined,
          release: async () => undefined,
        };
      },
    };
    const blockingWriter = new BlockingAtomicFileWriter();
    const firstDatabase = new JsonFileDatabase({
      filePath: firstPath,
      schema,
      logger: NOOP_LOGGER,
      fileLock: recordingLock,
      atomicFileWriter: blockingWriter,
    });
    const secondDatabase = new JsonFileDatabase({
      filePath: secondPath,
      schema,
      logger: NOOP_LOGGER,
      fileLock: recordingLock,
    });

    const firstMutation = firstDatabase.insert('records', {
      id: 'first',
      value: 1,
      active: true,
    });
    await blockingWriter.started;
    const secondMutation = secondDatabase.insert('records', {
      id: 'second',
      value: 2,
      active: true,
    });

    try {
      await secondAcquisition;
    } finally {
      blockingWriter.continue();
    }

    await Promise.all([firstMutation, secondMutation]);
  });
});
