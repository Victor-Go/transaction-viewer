import type { TransactionRecord } from './transaction-record.ts';

const merchants = [
  'Northern Grocer',
  'Maple Transit',
  'Harbour Books',
  'Aurora Coffee',
  'Cedar Pharmacy',
] as const;

const DEMO_BASE_TIMESTAMP = Date.parse('2026-05-01T00:00:00.000Z');
const MAX_INTERVAL_MILLISECONDS = 24 * 60 * 60 * 1000;

// Mulberry32: a small fixed-seed PRNG used only for reproducible demo intervals.
const createDeterministicRandom = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

export const createDemoTransactionRecords = (): TransactionRecord[] => {
  const records: TransactionRecord[] = [];
  const random = createDeterministicRandom(0x20260501);
  let timestampMilliseconds = DEMO_BASE_TIMESTAMP;

  for (let index = 1; index <= 45; index += 1) {
    const status =
      index <= 15 ? 'pending' : index <= 30 ? 'posted' : 'reversed';
    if (index > 1) {
      timestampMilliseconds +=
        1 + Math.floor(random() * MAX_INTERVAL_MILLISECONDS);
    }
    const timestamp = new Date(timestampMilliseconds).toISOString();
    const common = {
      id: `txn-demo-${String(index).padStart(3, '0')}`,
      accountId: 'acc_demo',
      merchantName: merchants[(index - 1) % merchants.length]!,
      amount: { minorUnits: 500 + index * 137, currency: 'CAD' as const },
      transactionDate: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const reversedAt = new Date(
      timestampMilliseconds + 60 * 60 * 1000,
    ).toISOString();
    records.push(
      status === 'reversed'
        ? {
            ...common,
            status,
            updatedAt: reversedAt,
            reversedAt,
          }
        : { ...common, status, reversedAt: null },
    );
  }

  for (let index = 1; index <= 5; index += 1) {
    timestampMilliseconds +=
      1 + Math.floor(random() * MAX_INTERVAL_MILLISECONDS);
    const timestamp = new Date(timestampMilliseconds).toISOString();
    records.push({
      id: `txn-secondary-${String(index).padStart(3, '0')}`,
      accountId: 'acc_secondary',
      merchantName: merchants[index % merchants.length]!,
      amount: { minorUnits: 1000 + index * 211, currency: 'CAD' },
      status: 'posted',
      transactionDate: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      reversedAt: null,
    });
  }

  return records;
};
