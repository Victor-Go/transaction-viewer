import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRuntimeApp } from './bootstrap.ts';
import { NOOP_LOGGER } from './shared/observability/logger.ts';
import { createTransactionDatabase } from './modules/transactions/infrastructure/transaction-database.ts';

const directories: string[] = [];
const temporaryDirectory = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'bootstrap-'));
  directories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const recordsAt = async (filePath: string): Promise<unknown[]> =>
  JSON.parse(await readFile(filePath, 'utf8')).collections.transactions;

describe('createRuntimeApp', () => {
  it('rejects invalid runtime configuration without exiting the process', async () => {
    const exit = vi.spyOn(process, 'exit');

    await expect(
      createRuntimeApp({
        argv: ['--database-file'],
        env: {},
        logger: NOOP_LOGGER,
      }),
    ).rejects.toThrow();
    expect(exit).not.toHaveBeenCalled();
    exit.mockRestore();
  });

  it('creates and preserves the default demo database and composes a working route', async () => {
    const dataDirectory = await temporaryDirectory();
    const first = await createRuntimeApp({
      argv: [],
      env: {},
      dataDirectory,
      logger: NOOP_LOGGER,
    });
    expect(first.databaseFile).toBe(path.join(dataDirectory, 'default.json'));
    expect(await recordsAt(first.databaseFile)).toHaveLength(50);
    const response = await request(first.app).get(
      '/api/v1/accounts/acc_demo/transactions',
    );
    expect(response.status).toBe(200);

    const original = await readFile(first.databaseFile, 'utf8');
    await createRuntimeApp({
      argv: [],
      env: {},
      dataDirectory,
      logger: NOOP_LOGGER,
    });
    expect(await readFile(first.databaseFile, 'utf8')).toBe(original);
  });

  it('honours CLI then environment selection and keeps explicit files empty unless seeded', async () => {
    const dataDirectory = await temporaryDirectory();
    const environment = await createRuntimeApp({
      argv: [],
      env: { DATABASE_FILE: 'environment.json' },
      dataDirectory,
      logger: NOOP_LOGGER,
    });
    expect(environment.databaseFile).toBe(
      path.join(dataDirectory, 'environment.json'),
    );
    expect(await recordsAt(environment.databaseFile)).toEqual([]);

    const cli = await createRuntimeApp({
      argv: ['--database-file', 'cli.json'],
      env: { DATABASE_FILE: 'environment.json' },
      dataDirectory,
      logger: NOOP_LOGGER,
    });
    expect(cli.databaseFile).toBe(path.join(dataDirectory, 'cli.json'));
    expect(await recordsAt(cli.databaseFile)).toEqual([]);

    const seeded = await createRuntimeApp({
      argv: ['--database-file=seeded.json', '--seed-demo'],
      env: {},
      dataDirectory,
      logger: NOOP_LOGGER,
    });
    expect(await recordsAt(seeded.databaseFile)).toHaveLength(50);
  });

  it('never seeds or overwrites an existing explicit database', async () => {
    const dataDirectory = await temporaryDirectory();
    const first = await createRuntimeApp({
      argv: ['--database-file=custom.json'],
      env: {},
      dataDirectory,
      logger: NOOP_LOGGER,
    });
    const original = await readFile(first.databaseFile, 'utf8');
    await createRuntimeApp({
      argv: ['--database-file=custom.json', '--seed-demo'],
      env: {},
      dataDirectory,
      logger: NOOP_LOGGER,
    });
    expect(await readFile(first.databaseFile, 'utf8')).toBe(original);
  });

  it('serves transactions from the selected database rather than a hidden default', async () => {
    const dataDirectory = await temporaryDirectory();
    const selectedFile = path.join(dataDirectory, 'selected.json');
    const database = createTransactionDatabase(selectedFile, NOOP_LOGGER);
    await database.initialize({
      metadata: { schemaVersion: 1 },
      collections: { transactions: [], idempotency: [] },
    });
    await database.insert('transactions', {
      id: 'selected-only',
      accountId: 'selected-account',
      merchantName: 'Selected Merchant',
      amount: { minorUnits: 100, currency: 'CAD' },
      status: 'posted',
      transactionDate: '2026-05-01T00:00:00.000Z',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      reversedAt: null,
    });
    const runtime = await createRuntimeApp({
      argv: ['--database-file', selectedFile],
      env: {},
      dataDirectory,
      logger: NOOP_LOGGER,
    });

    const response = await request(runtime.app).get(
      '/api/v1/accounts/selected-account/transactions',
    );
    expect(response.status).toBe(200);
    expect(response.body.meta.totalCount).toBe(1);
    expect(response.body.data[0].id).toBe('selected-only');

    const single = await request(runtime.app).get(
      '/api/v1/accounts/selected-account/transactions/selected-only',
    );
    expect(single.status).toBe(200);
    expect(single.body.data.id).toBe('selected-only');
  });

  it('provides startup reconciliation for pending transactions left during downtime', async () => {
    const dataDirectory = await temporaryDirectory();
    const selectedFile = path.join(dataDirectory, 'catch-up.json');
    const database = createTransactionDatabase(selectedFile, NOOP_LOGGER);
    await database.initialize({
      metadata: { schemaVersion: 1 },
      collections: { transactions: [], idempotency: [] },
    });
    await database.insert('transactions', {
      id: 'stale-pending',
      accountId: 'catch-up-account',
      merchantName: 'Catch-up Merchant',
      amount: { minorUnits: 100, currency: 'CAD' },
      status: 'pending',
      transactionDate: '2026-05-01T00:00:00.000Z',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      reversedAt: null,
    });
    const runtime = await createRuntimeApp({
      argv: ['--database-file', selectedFile],
      env: {},
      dataDirectory,
      logger: NOOP_LOGGER,
    });

    await runtime.scheduler.reconcile();

    const response = await request(runtime.app).get(
      '/api/v1/accounts/catch-up-account/transactions',
    );
    expect(response.status).toBe(200);
    expect(response.body.data[0].status).toBe('posted');
  });
});
