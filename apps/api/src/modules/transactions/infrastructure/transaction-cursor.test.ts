import { describe, expect, it, vi } from 'vitest';

import { TransactionCursorCodec } from './transaction-cursor.ts';
import {
  InvalidGeneratedPageTokenError,
  InvalidPageTokenError,
} from '../application/errors/invalid-page-token.error.ts';

describe('TransactionCursorCodec', () => {
  const codec = new TransactionCursorCodec();
  const scope = { accountId: 'acc_demo', status: 'posted' as const };
  const boundary = {
    transactionDate: new Date('2026-07-20T18:30:00.000Z'),
    id: 'txn-020',
  };

  it('round-trips a versioned, account-and-status-scoped cursor', () => {
    const token = codec.encode({ ...scope, ...boundary });

    expect(token.length).toBeLessThanOrEqual(2048);
    expect(codec.decode(token, scope)).toEqual(boundary);
  });

  it('guards token length and encoding before attempting base64url decoding', () => {
    const bufferFrom = vi.spyOn(Buffer, 'from');

    expect(() => codec.decode('', scope)).toThrow(InvalidPageTokenError);
    expect(() => codec.decode('a'.repeat(2049), scope)).toThrow(
      InvalidPageTokenError,
    );
    expect(() => codec.decode('invalid+base64url', scope)).toThrow(
      InvalidPageTokenError,
    );
    expect(bufferFrom).not.toHaveBeenCalled();

    expect(() => codec.decode('a'.repeat(2048), scope)).toThrow(
      InvalidPageTokenError,
    );
    expect(bufferFrom).toHaveBeenCalledOnce();
    bufferFrom.mockRestore();
  });

  it('supports the absence of a status scope and different IDs at one timestamp', () => {
    const noStatusScope = { accountId: 'acc_demo' };
    const first = codec.encode({
      ...noStatusScope,
      ...boundary,
      id: 'txn-002',
    });
    const second = codec.encode({
      ...noStatusScope,
      ...boundary,
      id: 'txn-001',
    });

    expect(codec.decode(first, noStatusScope).id).toBe('txn-002');
    expect(codec.decode(second, noStatusScope).id).toBe('txn-001');
  });

  it.each([
    ['malformed base64url', 'not+base64'],
    ['malformed JSON', Buffer.from('not json').toString('base64url')],
    [
      'unsupported version',
      Buffer.from(
        JSON.stringify({
          v: 2,
          accountId: 'acc_demo',
          status: 'posted',
          transactionDate: '2026-07-20T18:30:00.000Z',
          id: 'txn-020',
        }),
      ).toString('base64url'),
    ],
    [
      'missing fields',
      Buffer.from(JSON.stringify({ v: 1 })).toString('base64url'),
    ],
  ])('rejects %s', (_description, token) => {
    expect(() => codec.decode(token, scope)).toThrow(InvalidPageTokenError);
  });

  it('rejects account and status scope mismatches', () => {
    const token = codec.encode({ ...scope, ...boundary });

    expect(() =>
      codec.decode(token, { accountId: 'another', status: 'posted' }),
    ).toThrow(InvalidPageTokenError);
    expect(() =>
      codec.decode(token, { accountId: 'acc_demo', status: 'pending' }),
    ).toThrow(InvalidPageTokenError);
  });

  it('keeps the longest valid account and transaction IDs within the page-token limit', () => {
    const token = codec.encode({
      accountId: 'a'.repeat(128),
      status: 'reversed',
      transactionDate: boundary.transactionDate,
      id: 'x'.repeat(64),
    });

    expect(token.length).toBeLessThanOrEqual(2048);
  });

  it('rejects an invalid generated cursor boundary with a typed internal error', () => {
    expect(() =>
      codec.encode({
        accountId: 'acc_demo',
        transactionDate: boundary.transactionDate,
        id: 'x'.repeat(65),
      }),
    ).toThrow(InvalidGeneratedPageTokenError);
  });

  it.each(['a'.repeat(129), ' acc_demo', 'acc_demo ', '   '])(
    'rejects the invalid generated account ID %j',
    (accountId) => {
      expect(() =>
        codec.encode({
          accountId,
          transactionDate: boundary.transactionDate,
          id: boundary.id,
        }),
      ).toThrow(InvalidGeneratedPageTokenError);
    },
  );

  it('rejects a cursor payload containing an invalid account ID', () => {
    const accountId = ' acc_demo';
    const token = Buffer.from(
      JSON.stringify({
        v: 1,
        accountId,
        status: null,
        transactionDate: boundary.transactionDate.toISOString(),
        id: boundary.id,
      }),
    ).toString('base64url');

    expect(() => codec.decode(token, { accountId })).toThrow(
      InvalidPageTokenError,
    );
  });
});
