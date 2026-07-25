import type {
  StoredTransactionCommand,
  TransactionCommandRepository,
  TransactionCommandSession,
} from '../application/ports/transaction-command-repository.ts';
import type { Transaction } from '../domain/transaction.ts';
import type { JsonFileDatabase } from '../../../shared/persistence/json/json-file-database.ts';
import type { JsonDatabaseTransaction } from '../../../shared/persistence/json/json-file-database.types.ts';
import type { TransactionCollections } from './transaction-database.ts';
import {
  transactionFromRecord,
  transactionToRecord,
} from './transaction-record.ts';

class JsonTransactionCommandSession implements TransactionCommandSession {
  constructor(
    private readonly transaction: JsonDatabaseTransaction<TransactionCollections>,
  ) {}

  findCommand(keyHash: string): StoredTransactionCommand | null {
    const record = this.transaction.findOne(
      'idempotency',
      (candidate) => candidate.keyHash === keyHash,
    );
    return record === null
      ? null
      : {
          keyHash: record.keyHash,
          operation: record.operation,
          fingerprintHash: record.fingerprintHash,
          transaction: transactionFromRecord(record.transaction),
          createdAt: new Date(record.createdAt),
        };
  }

  saveCommand(command: StoredTransactionCommand): void {
    const common = {
      keyHash: command.keyHash,
      fingerprintHash: command.fingerprintHash,
      createdAt: command.createdAt.toISOString(),
    };
    const transaction = transactionToRecord(command.transaction);
    if (command.operation === 'create-transaction') {
      if (transaction.status !== 'pending') {
        throw new Error('Create idempotency result invariant failed');
      }
      this.transaction.insert('idempotency', {
        ...common,
        operation: 'create-transaction',
        httpStatus: 201,
        transaction,
      });
      return;
    }
    if (transaction.status !== 'reversed') {
      throw new Error('Reversal idempotency result invariant failed');
    }
    this.transaction.insert('idempotency', {
      ...common,
      operation: 'reverse-transaction',
      httpStatus: 200,
      transaction,
    });
  }

  hasTransactionId(id: string): boolean {
    return (
      this.transaction.findOne('transactions', (record) => record.id === id) !==
      null
    );
  }

  insertTransaction(transaction: Transaction): void {
    this.transaction.insert('transactions', transactionToRecord(transaction));
  }

  findTransaction(
    accountId: string,
    transactionId: string,
  ): Transaction | null {
    const record = this.transaction.findOne(
      'transactions',
      (candidate) =>
        candidate.accountId === accountId && candidate.id === transactionId,
    );
    return record === null ? null : transactionFromRecord(record);
  }

  replaceTransaction(transaction: Transaction): void {
    const result = this.transaction.updateWhere(
      'transactions',
      (record) => record.id === transaction.id,
      () => transactionToRecord(transaction),
    );
    if (result.matchedCount !== 1) {
      throw new Error('Transaction replacement invariant failed');
    }
  }

  findPendingCreatedAtOrBefore(cutoff: Date): Transaction[] {
    return this.transaction
      .find(
        'transactions',
        (record) =>
          record.status === 'pending' &&
          Date.parse(record.createdAt) <= cutoff.valueOf(),
      )
      .map(transactionFromRecord);
  }
}

export class JsonTransactionCommandRepository implements TransactionCommandRepository {
  constructor(
    private readonly database: JsonFileDatabase<TransactionCollections>,
  ) {}

  transaction<Result>(
    work: (session: TransactionCommandSession) => Result,
  ): Promise<Result> {
    return this.database.transaction<Result>(
      (transaction) =>
        work(new JsonTransactionCommandSession(transaction)) as never,
    );
  }
}
