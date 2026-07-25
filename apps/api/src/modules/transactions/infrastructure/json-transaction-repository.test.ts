import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { NOOP_LOGGER } from '../../../shared/observability/logger.ts';

import {
  createTransactionDatabase,
  initializeTransactionDatabase,
} from './transaction-database.ts';
import { JsonTransactionRepository } from './json-transaction-repository.ts';

const directories: string[] = [];

const setup = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'transaction-repo-'));
  directories.push(directory);
  const database = createTransactionDatabase(
    path.join(directory, 'database.json'),
    NOOP_LOGGER,
  );
  await initializeTransactionDatabase(database, { seedDemo: true });
  return { database, repository: new JsonTransactionRepository(database) };
};

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('JsonTransactionRepository', () => {
  it('finds one transaction only within its account scope', async () => {
    const { repository } = await setup();

    const found = await repository.findByAccountAndId(
      'acc_demo',
      'txn-demo-001',
    );

    expect(found).not.toBeNull();
    expect(found?.accountId).toBe('acc_demo');
    expect(found?.transactionDate).toBeInstanceOf(Date);
    await expect(
      repository.findByAccountAndId('another-account', 'txn-demo-001'),
    ).resolves.toBeNull();
    await expect(
      repository.findByAccountAndId('acc_demo', 'missing'),
    ).resolves.toBeNull();
  });

  it('maps records to domain Dates, filters, counts, orders, and paginates by keyset', async () => {
    const { repository } = await setup();
    const first = await repository.listByAccount({
      accountId: 'acc_demo',
      status: 'posted',
      pageSize: 7,
    });

    expect(first.transactions).toHaveLength(7);
    expect(first.totalCount).toBe(15);
    expect(first.pageSize).toBe(7);
    expect(first.hasMore).toBe(true);
    expect(first.transactions[0]?.transactionDate).toBeInstanceOf(Date);

    if (!first.hasMore) throw new Error('expected another page');
    const second = await repository.listByAccount({
      accountId: 'acc_demo',
      status: 'posted',
      pageSize: 7,
      pageToken: first.nextPageToken,
    });
    expect(second.transactions).toHaveLength(7);
    const firstIds = new Set(first.transactions.map(({ id }) => id));
    expect(second.transactions.some(({ id }) => firstIds.has(id))).toBe(false);
  });

  it('returns an empty final page for an unknown account', async () => {
    const { repository } = await setup();
    await expect(
      repository.listByAccount({ accountId: 'unknown', pageSize: 20 }),
    ).resolves.toEqual({
      transactions: [],
      pageSize: 20,
      totalCount: 0,
      hasMore: false,
      nextPageToken: null,
    });
  });

  it('uses ID descending as the tie-breaker for identical transaction dates', async () => {
    const { database, repository } = await setup();
    const timestamp = '2028-01-01T00:00:00.000Z';
    for (const id of ['tie-a', 'tie-z']) {
      await database.insert('transactions', {
        id,
        accountId: 'tie-account',
        merchantName: 'Tie Merchant',
        amount: { minorUnits: 100, currency: 'CAD' },
        status: 'posted',
        transactionDate: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        reversedAt: null,
      });
    }
    const page = await repository.listByAccount({
      accountId: 'tie-account',
      pageSize: 20,
    });
    expect(page.transactions.map(({ id }) => id)).toEqual(['tie-z', 'tie-a']);
  });

  it('keeps the cursor boundary stable across newer inserts while totalCount is current', async () => {
    const { database, repository } = await setup();
    const first = await repository.listByAccount({
      accountId: 'acc_demo',
      pageSize: 5,
    });
    if (!first.hasMore) throw new Error('expected another page');

    for (let index = 0; index < 3; index += 1) {
      await database.insert('transactions', {
        id: `txn-new-${index}`,
        accountId: 'acc_demo',
        merchantName: 'New Merchant',
        amount: { minorUnits: 100 + index, currency: 'CAD' },
        status: 'posted',
        transactionDate: `2027-01-0${index + 1}T12:00:00.000Z`,
        createdAt: `2027-01-0${index + 1}T12:00:00.000Z`,
        updatedAt: `2027-01-0${index + 1}T12:00:00.000Z`,
        reversedAt: null,
      });
    }
    const second = await repository.listByAccount({
      accountId: 'acc_demo',
      pageSize: 5,
      pageToken: first.nextPageToken,
    });
    expect(second.totalCount).toBe(48);
    const forbiddenIds = new Set([
      ...first.transactions.map(({ id }) => id),
      'txn-new-0',
      'txn-new-1',
      'txn-new-2',
    ]);
    expect(second.transactions.some(({ id }) => forbiddenIds.has(id))).toBe(
      false,
    );
  });

  it('rejects duplicate IDs and propagates persistence failures', async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'transaction-invalid-'),
    );
    directories.push(directory);
    const filePath = path.join(directory, 'database.json');
    const database = createTransactionDatabase(filePath, NOOP_LOGGER);
    await writeFile(
      filePath,
      JSON.stringify({
        metadata: { schemaVersion: 1 },
        collections: {
          transactions: [
            {
              id: 'duplicate',
              accountId: 'acc_demo',
              merchantName: 'A',
              amount: { minorUnits: 1, currency: 'CAD' },
              status: 'posted',
              transactionDate: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              reversedAt: null,
            },
            {
              id: 'duplicate',
              accountId: 'acc_demo',
              merchantName: 'B',
              amount: { minorUnits: 2, currency: 'CAD' },
              status: 'posted',
              transactionDate: '2026-01-02T00:00:00.000Z',
              createdAt: '2026-01-02T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
              reversedAt: null,
            },
          ],
        },
      }),
    );
    await expect(
      new JsonTransactionRepository(database).listByAccount({
        accountId: 'acc_demo',
        pageSize: 20,
      }),
    ).rejects.toThrow();
  });
});
