import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { NOOP_LOGGER } from '../../../shared/observability/logger.ts';

import {
  createTransactionDatabase,
  initializeTransactionDatabase,
  transactionDatabaseSchema,
} from './transaction-database.ts';
import { createDemoTransactionRecords } from './demo-transactions.ts';

const directories: string[] = [];

const temporaryFile = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'transaction-demo-'));
  directories.push(directory);
  return path.join(directory, 'database.json');
};

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('demo transaction initialization', () => {
  it('generates the exact deterministic distribution and valid records', () => {
    const records = createDemoTransactionRecords();
    const demo = records.filter((record) => record.accountId === 'acc_demo');

    expect(records).toHaveLength(50);
    expect(demo).toHaveLength(45);
    expect(
      records.filter((record) => record.accountId === 'acc_secondary'),
    ).toHaveLength(5);
    expect(demo.filter((record) => record.status === 'pending')).toHaveLength(
      15,
    );
    expect(demo.filter((record) => record.status === 'posted')).toHaveLength(
      15,
    );
    expect(demo.filter((record) => record.status === 'reversed')).toHaveLength(
      15,
    );
    expect(new Set(records.map((record) => record.id)).size).toBe(50);
    expect(new Set(records.map((record) => record.transactionDate)).size).toBe(
      50,
    );
    expect(() =>
      transactionDatabaseSchema.parse({
        metadata: { schemaVersion: 1 },
        collections: { transactions: records },
      }),
    ).not.toThrow();
  });

  it('starts in May 2026 and advances by deterministic positive intervals of at most 24 hours', () => {
    const first = createDemoTransactionRecords();
    const second = createDemoTransactionRecords();

    expect(second).toEqual(first);
    expect(first[0]?.transactionDate).toBe('2026-05-01T00:00:00.000Z');
    for (let index = 1; index < first.length; index += 1) {
      const interval =
        Date.parse(first[index]!.transactionDate) -
        Date.parse(first[index - 1]!.transactionDate);
      expect(interval).toBeGreaterThan(0);
      expect(interval).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
      expect(Number.isInteger(interval)).toBe(true);
    }
  });

  it('uses lifecycle timestamps consistently for every generated status', () => {
    const records = createDemoTransactionRecords();
    const reversed = records.filter((record) => record.status === 'reversed');
    const unreversed = records.filter((record) => record.status !== 'reversed');

    expect(reversed).not.toHaveLength(0);
    for (const record of reversed) {
      expect(record.reversedAt).not.toBeNull();
      expect(record.updatedAt).toBe(record.reversedAt);
      expect(record.createdAt).toBeTruthy();
      expect(record.createdAt).not.toBe(record.reversedAt);
    }
    for (const record of unreversed) {
      expect(record.reversedAt).toBeNull();
      expect(record.updatedAt).toBe(record.createdAt);
    }
    expect(() =>
      transactionDatabaseSchema.parse({
        metadata: { schemaVersion: 1 },
        collections: { transactions: records },
      }),
    ).not.toThrow();
  });

  it('is idempotent, does not overwrite existing data, and seeds only when requested', async () => {
    const emptyFile = await temporaryFile();
    const emptyDatabase = createTransactionDatabase(emptyFile, NOOP_LOGGER);
    await initializeTransactionDatabase(emptyDatabase, { seedDemo: false });
    await initializeTransactionDatabase(emptyDatabase, { seedDemo: true });
    expect(await emptyDatabase.find('transactions')).toEqual([]);

    const demoFile = await temporaryFile();
    const demoDatabase = createTransactionDatabase(demoFile, NOOP_LOGGER);
    await initializeTransactionDatabase(demoDatabase, { seedDemo: true });
    await initializeTransactionDatabase(demoDatabase, { seedDemo: true });
    expect(await demoDatabase.find('transactions')).toHaveLength(50);
    const document: unknown = JSON.parse(await readFile(demoFile, 'utf8'));
    expect(() => transactionDatabaseSchema.parse(document)).not.toThrow();
  });
});
