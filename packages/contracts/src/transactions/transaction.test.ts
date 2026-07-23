import { describe, expect, it } from 'vitest';

import {
  moneyDtoSchema,
  transactionDtoSchema,
  transactionStatusSchema,
} from './transaction.ts';

const commonTransactionFields = {
  id: 'txn-001',
  accountId: 'account-001',
  merchantName: 'Northern Grocer',
  amount: {
    minorUnits: 2599,
    currency: 'CAD',
  },
  transactionDate: '2026-07-20T18:30:00.000Z',
  createdAt: '2026-07-20T18:31:00.000Z',
  updatedAt: '2026-07-20T18:31:00.000Z',
};

const postedTransactionDto = {
  ...commonTransactionFields,
  status: 'posted',
  reversedAt: null,
};

const reversedTransactionDto = {
  ...commonTransactionFields,
  status: 'reversed',
  reversedAt: '2026-07-21T09:00:00.000Z',
};

describe('transactionStatusSchema', () => {
  it.each(['pending', 'posted', 'reversed'])(
    'accepts the transaction status %s',
    (status) => {
      expect(transactionStatusSchema.parse(status)).toBe(status);
    },
  );

  it('rejects an unknown transaction status', () => {
    expect(transactionStatusSchema.safeParse('declined').success).toBe(false);
  });
});

describe('moneyDtoSchema', () => {
  it('accepts non-negative integer CAD minor units', () => {
    const money = {
      minorUnits: 2599,
      currency: 'CAD',
    };

    expect(moneyDtoSchema.parse(money)).toEqual(money);
    expect(moneyDtoSchema.parse({ minorUnits: 0, currency: 'CAD' })).toEqual({
      minorUnits: 0,
      currency: 'CAD',
    });
  });

  it('rejects fractional minor units', () => {
    expect(
      moneyDtoSchema.safeParse({ minorUnits: 25.99, currency: 'CAD' }).success,
    ).toBe(false);
  });

  it('rejects negative minor units', () => {
    expect(
      moneyDtoSchema.safeParse({ minorUnits: -1, currency: 'CAD' }).success,
    ).toBe(false);
  });

  it('rejects currencies other than CAD', () => {
    expect(
      moneyDtoSchema.safeParse({ minorUnits: 2599, currency: 'USD' }).success,
    ).toBe(false);
  });
});

describe('transactionDtoSchema', () => {
  it.each([
    ['pending', null],
    ['posted', null],
    ['reversed', '2026-07-21T09:00:00.000Z'],
  ])('accepts %s with the matching reversedAt value', (status, reversedAt) => {
    const transaction = {
      ...commonTransactionFields,
      status,
      reversedAt,
    };

    expect(transactionDtoSchema.parse(transaction)).toEqual(transaction);
  });

  it.each(['pending', 'posted'])(
    'rejects %s with a reversal timestamp',
    (status) => {
      expect(
        transactionDtoSchema.safeParse({
          ...commonTransactionFields,
          status,
          reversedAt: '2026-07-21T09:00:00.000Z',
        }).success,
      ).toBe(false);
    },
  );

  it('rejects reversed with a null reversedAt', () => {
    expect(
      transactionDtoSchema.safeParse({
        ...commonTransactionFields,
        status: 'reversed',
        reversedAt: null,
      }).success,
    ).toBe(false);
  });

  it('rejects a transaction with a required field missing', () => {
    const incompleteTransaction: Partial<typeof postedTransactionDto> = {
      ...postedTransactionDto,
    };
    delete incompleteTransaction.merchantName;

    expect(transactionDtoSchema.safeParse(incompleteTransaction).success).toBe(
      false,
    );
  });

  it.each(['id', 'accountId', 'merchantName'] as const)(
    'rejects an empty %s',
    (field) => {
      expect(
        transactionDtoSchema.safeParse({
          ...postedTransactionDto,
          [field]: '',
        }).success,
      ).toBe(false);
    },
  );

  it.each(['id', 'accountId', 'merchantName'] as const)(
    'rejects a whitespace-only %s',
    (field) => {
      expect(
        transactionDtoSchema.safeParse({
          ...postedTransactionDto,
          [field]: '   ',
        }).success,
      ).toBe(false);
    },
  );

  it('does not trim non-blank response strings', () => {
    const transaction = {
      ...postedTransactionDto,
      merchantName: '  Northern Grocer  ',
    };

    expect(transactionDtoSchema.parse(transaction).merchantName).toBe(
      '  Northern Grocer  ',
    );
  });

  it.each(['transactionDate', 'createdAt', 'updatedAt'] as const)(
    'rejects an invalid ISO timestamp in %s',
    (field) => {
      expect(
        transactionDtoSchema.safeParse({
          ...postedTransactionDto,
          [field]: '20 July 2026',
        }).success,
      ).toBe(false);
    },
  );

  it('rejects an invalid reversedAt timestamp', () => {
    expect(
      transactionDtoSchema.safeParse({
        ...reversedTransactionDto,
        reversedAt: '21 July 2026',
      }).success,
    ).toBe(false);
  });

  it('requires HTTP timestamps to use UTC', () => {
    expect(
      transactionDtoSchema.safeParse({
        ...postedTransactionDto,
        transactionDate: '2026-07-20T18:30:00+01:00',
      }).success,
    ).toBe(false);
  });

  it('rejects undeclared internal fields', () => {
    expect(
      transactionDtoSchema.safeParse({
        ...postedTransactionDto,
        internalLedgerId: 'ledger-001',
      }).success,
    ).toBe(false);
  });
});
