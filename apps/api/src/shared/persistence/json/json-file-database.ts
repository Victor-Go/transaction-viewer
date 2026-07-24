import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { AtomicFileWriter } from './atomic-file-writer.ts';
import {
  assertDatabaseTargetIsNotSymlink,
  resolveCanonicalDatabasePath,
} from './database-path.ts';
import {
  type FileLock,
  type FileLockHandle,
  ProperFileLock,
} from './file-lock.ts';
import {
  AsyncTransactionCallbackError,
  DatabaseFileMissingError,
  DatabaseReadError,
  DatabaseSerializationError,
  DatabaseSizeLimitExceededError,
  InvalidDatabaseDocumentError,
  MalformedDatabaseJsonError,
  UnsupportedDatabaseSchemaVersionError,
} from './json-file-database.errors.ts';
import { assertJsonSafe } from './json-safety.ts';
import type {
  CollectionMap,
  CollectionName,
  CollectionRecord,
  DatabaseInitializationResult,
  JsonDatabaseDocument,
  JsonDatabaseTransaction,
  UpdateWhereResult,
} from './json-file-database.types.ts';
import { KeyedMutex } from './keyed-mutex.ts';

export interface JsonDatabaseRuntimeSchema<
  Collections extends CollectionMap<Collections>,
> {
  readonly schemaVersion: number;
  parse(input: unknown): JsonDatabaseDocument<Collections>;
}

export interface JsonFileDatabaseOptions<
  Collections extends CollectionMap<Collections>,
> {
  readonly filePath: string;
  readonly schema: JsonDatabaseRuntimeSchema<Collections>;
  readonly fileLock?: FileLock;
  readonly atomicFileWriter?: AtomicFileWriter;
}

const processLocalWriteMutex = new KeyedMutex();

export const MAX_DATABASE_FILE_BYTES = 1_048_576;

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && 'code' in error;

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  if (
    (typeof value !== 'object' || value === null) &&
    typeof value !== 'function'
  ) {
    return false;
  }

  return typeof (value as { then?: unknown }).then === 'function';
};

const clone = <Value>(value: Value): Value => structuredClone(value);

const assertMutationValueIsJsonSafe = (value: unknown): void => {
  try {
    assertJsonSafe(value);
  } catch (error) {
    throw new DatabaseSerializationError(error);
  }
};

type SynchronousResult<Result> =
  Result extends PromiseLike<unknown> ? never : Result;

class WorkingTransaction<
  Collections extends CollectionMap<Collections>,
> implements JsonDatabaseTransaction<Collections> {
  constructor(private readonly document: JsonDatabaseDocument<Collections>) {}

  find<Name extends CollectionName<Collections>>(
    collectionName: Name,
    predicate: (record: CollectionRecord<Collections, Name>) => boolean = () =>
      true,
  ): CollectionRecord<Collections, Name>[] {
    const records = this.collection(collectionName);

    return records
      .filter((record) => predicate(clone(record)))
      .map((record) => clone(record));
  }

  findOne<Name extends CollectionName<Collections>>(
    collectionName: Name,
    predicate: (record: CollectionRecord<Collections, Name>) => boolean,
  ): CollectionRecord<Collections, Name> | null {
    const found = this.collection(collectionName).find((record) =>
      predicate(clone(record)),
    );

    return found === undefined ? null : clone(found);
  }

  insert<Name extends CollectionName<Collections>>(
    collectionName: Name,
    record: CollectionRecord<Collections, Name>,
  ): CollectionRecord<Collections, Name> {
    assertMutationValueIsJsonSafe(record);
    const inserted = clone(record);
    this.collection(collectionName).push(inserted);
    return clone(inserted);
  }

  updateWhere<Name extends CollectionName<Collections>>(
    collectionName: Name,
    predicate: (record: CollectionRecord<Collections, Name>) => boolean,
    updater: (
      record: CollectionRecord<Collections, Name>,
    ) => CollectionRecord<Collections, Name>,
  ): UpdateWhereResult<CollectionRecord<Collections, Name>> {
    const records = this.collection(collectionName);
    const updatedRecords: CollectionRecord<Collections, Name>[] = [];

    for (let index = 0; index < records.length; index += 1) {
      const current = records[index];
      if (current !== undefined && predicate(clone(current))) {
        const updated = updater(clone(current));
        assertMutationValueIsJsonSafe(updated);
        const replacement = clone(updated);
        records[index] = replacement;
        updatedRecords.push(clone(replacement));
      }
    }

    return {
      matchedCount: updatedRecords.length,
      updatedRecords,
    };
  }

  private collection<Name extends CollectionName<Collections>>(
    collectionName: Name,
  ): CollectionRecord<Collections, Name>[] {
    return this.document.collections[
      collectionName
    ] as unknown as CollectionRecord<Collections, Name>[];
  }
}

export class JsonFileDatabase<Collections extends CollectionMap<Collections>> {
  readonly #configuredFilePath: string;
  readonly #schema: JsonDatabaseRuntimeSchema<Collections>;
  readonly #fileLock: FileLock;
  readonly #atomicFileWriter: AtomicFileWriter;

  constructor({
    filePath,
    schema,
    fileLock = new ProperFileLock(),
    atomicFileWriter = new AtomicFileWriter(),
  }: JsonFileDatabaseOptions<Collections>) {
    this.#configuredFilePath = path.normalize(path.resolve(filePath));
    this.#schema = schema;
    this.#fileLock = fileLock;
    this.#atomicFileWriter = atomicFileWriter;
  }

  async initialize(
    initialDocument: JsonDatabaseDocument<Collections>,
  ): Promise<DatabaseInitializationResult> {
    const filePath = await resolveCanonicalDatabasePath(
      this.#configuredFilePath,
      true,
    );

    return this.withMutationLocks(filePath, async (lockHandle) => {
      await assertDatabaseTargetIsNotSymlink(filePath);
      try {
        await this.readLatestDocument(filePath);
        return { created: false };
      } catch (error) {
        if (!(error instanceof DatabaseFileMissingError)) {
          throw error;
        }
      }

      const validated = this.validateDocument(initialDocument);
      lockHandle.assertUsable();
      await this.writeDocument(filePath, validated, lockHandle);
      return { created: true };
    });
  }

  async find<Name extends CollectionName<Collections>>(
    collectionName: Name,
    predicate?: (record: CollectionRecord<Collections, Name>) => boolean,
  ): Promise<CollectionRecord<Collections, Name>[]> {
    const filePath = await this.resolveExistingDatabasePath();
    const document = await this.readLatestDocument(filePath);
    const transaction = new WorkingTransaction(document);
    return transaction.find(collectionName, predicate);
  }

  async findOne<Name extends CollectionName<Collections>>(
    collectionName: Name,
    predicate: (record: CollectionRecord<Collections, Name>) => boolean,
  ): Promise<CollectionRecord<Collections, Name> | null> {
    const filePath = await this.resolveExistingDatabasePath();
    const document = await this.readLatestDocument(filePath);
    const transaction = new WorkingTransaction(document);
    return transaction.findOne(collectionName, predicate);
  }

  async insert<Name extends CollectionName<Collections>>(
    collectionName: Name,
    record: CollectionRecord<Collections, Name>,
  ): Promise<CollectionRecord<Collections, Name>> {
    return this.runTransaction((transaction) =>
      transaction.insert(collectionName, record),
    );
  }

  async updateWhere<Name extends CollectionName<Collections>>(
    collectionName: Name,
    predicate: (record: CollectionRecord<Collections, Name>) => boolean,
    updater: (
      record: CollectionRecord<Collections, Name>,
    ) => CollectionRecord<Collections, Name>,
  ): Promise<UpdateWhereResult<CollectionRecord<Collections, Name>>> {
    return this.runTransaction((transaction) =>
      transaction.updateWhere(collectionName, predicate, updater),
    );
  }

  transaction<Result>(
    callback: (
      transaction: JsonDatabaseTransaction<Collections>,
    ) => SynchronousResult<Result>,
  ): Promise<Result>;
  async transaction<Result>(
    callback: (transaction: JsonDatabaseTransaction<Collections>) => Result,
  ): Promise<Result> {
    return this.runTransaction(callback);
  }

  private async runTransaction<Result>(
    callback: (transaction: JsonDatabaseTransaction<Collections>) => Result,
  ): Promise<Result> {
    const filePath = await this.resolveExistingDatabasePath();
    return this.withMutationLocks(filePath, async (lockHandle) => {
      await assertDatabaseTargetIsNotSymlink(filePath);
      const committed = await this.readLatestDocument(filePath);
      const working = clone(committed);
      const transaction = new WorkingTransaction(working);
      const result: unknown = callback(transaction);

      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(() => undefined);
        throw new AsyncTransactionCallbackError();
      }

      const validated = this.validateDocument(working);
      lockHandle.assertUsable();

      if (!isDeepStrictEqual(committed, validated)) {
        await this.writeDocument(filePath, validated, lockHandle);
      }

      return result as Result;
    });
  }

  private async resolveExistingDatabasePath(): Promise<string> {
    return resolveCanonicalDatabasePath(this.#configuredFilePath, false);
  }

  private async readLatestDocument(
    filePath: string,
  ): Promise<JsonDatabaseDocument<Collections>> {
    let fileSize: number;
    try {
      fileSize = (await stat(filePath)).size;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        throw new DatabaseFileMissingError(error);
      }
      throw new DatabaseReadError(error);
    }
    if (fileSize > MAX_DATABASE_FILE_BYTES) {
      throw new DatabaseSizeLimitExceededError();
    }

    let serialized: string;
    try {
      serialized = await readFile(filePath, 'utf8');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        throw new DatabaseFileMissingError(error);
      }
      throw new DatabaseReadError(error);
    }

    let input: unknown;
    try {
      input = JSON.parse(serialized);
    } catch (error) {
      throw new MalformedDatabaseJsonError(error);
    }

    return this.validateDocument(input);
  }

  private validateDocument(input: unknown): JsonDatabaseDocument<Collections> {
    const actualVersion =
      typeof input === 'object' &&
      input !== null &&
      'metadata' in input &&
      typeof input.metadata === 'object' &&
      input.metadata !== null &&
      'schemaVersion' in input.metadata
        ? input.metadata.schemaVersion
        : undefined;

    if (
      actualVersion !== undefined &&
      actualVersion !== this.#schema.schemaVersion
    ) {
      throw new UnsupportedDatabaseSchemaVersionError(
        this.#schema.schemaVersion,
        actualVersion,
      );
    }

    try {
      return this.#schema.parse(input);
    } catch (error) {
      throw new InvalidDatabaseDocumentError(error);
    }
  }

  private async writeDocument(
    filePath: string,
    document: JsonDatabaseDocument<Collections>,
    lockHandle: FileLockHandle,
  ): Promise<void> {
    const serialized = this.serializeDocument(document);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_DATABASE_FILE_BYTES) {
      throw new DatabaseSizeLimitExceededError();
    }

    await this.#atomicFileWriter.replace(filePath, serialized, () => {
      lockHandle.assertUsable();
    });
  }

  private serializeDocument(
    document: JsonDatabaseDocument<Collections>,
  ): string {
    try {
      assertJsonSafe(document);
      const serialized = `${JSON.stringify(document, null, 2)}\n`;
      const parsed: unknown = JSON.parse(serialized);
      const roundTripDocument = this.validateDocument(parsed);
      if (!isDeepStrictEqual(document, roundTripDocument)) {
        throw new TypeError(
          'The validated document changed during its JSON round-trip',
        );
      }
      return serialized;
    } catch (error) {
      throw new DatabaseSerializationError(error);
    }
  }

  private async withMutationLocks<Result>(
    filePath: string,
    work: (lockHandle: FileLockHandle) => Promise<Result>,
  ): Promise<Result> {
    return processLocalWriteMutex.runExclusive(filePath, async () => {
      const lockHandle = await this.#fileLock.acquire(filePath);
      let operationFailure: unknown;
      let result: Result | undefined;
      let operationFailed = false;

      try {
        result = await work(lockHandle);
      } catch (error) {
        operationFailed = true;
        operationFailure = error;
      } finally {
        try {
          await lockHandle.release();
        } catch {
          // A completed mutation or no-op determines the caller-visible result.
          // Stale-lock recovery handles any lock artifact left by failed cleanup.
        }
      }

      if (operationFailed) {
        throw operationFailure;
      }

      return result as Result;
    });
  }
}
