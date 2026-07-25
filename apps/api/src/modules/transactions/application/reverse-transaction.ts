import {
  IdempotencyConflictError,
  TransactionNotFoundError,
} from './errors/transaction-command.error.ts';
import type { TransactionCommandRepository } from './ports/transaction-command-repository.ts';
import type { Clock, StringHasher } from './ports/runtime-services.ts';
import type { ReversedTransaction } from '../domain/transaction.ts';
import { reversePostedTransaction } from '../domain/transaction-policy.ts';

export interface ReverseTransactionInput {
  readonly accountId: string;
  readonly transactionId: string;
  readonly idempotencyKey: string;
}

export interface ReverseTransactionResult {
  readonly transaction: ReversedTransaction;
  readonly replayed: boolean;
}

export class ReverseTransaction {
  constructor(
    private readonly repository: TransactionCommandRepository,
    private readonly clock: Clock,
    private readonly hasher: StringHasher,
  ) {}

  execute(input: ReverseTransactionInput): Promise<ReverseTransactionResult> {
    const now = this.clock.now();
    const keyHash = this.hasher.hash(`idempotency-key:${input.idempotencyKey}`);
    const fingerprintHash = this.hasher.hash(
      `fingerprint:${JSON.stringify({
        operation: 'reverse-transaction',
        accountId: input.accountId,
        transactionId: input.transactionId,
      })}`,
    );

    return this.repository.transaction((session) => {
      const stored = session.findCommand(keyHash);
      if (stored !== null) {
        if (
          stored.operation !== 'reverse-transaction' ||
          stored.fingerprintHash !== fingerprintHash
        ) {
          throw new IdempotencyConflictError();
        }
        if (stored.transaction.status !== 'reversed') {
          throw new TransactionNotFoundError();
        }
        return { transaction: stored.transaction, replayed: true };
      }

      const existing = session.findTransaction(
        input.accountId,
        input.transactionId,
      );
      if (existing === null) {
        throw new TransactionNotFoundError();
      }
      const transaction = reversePostedTransaction(existing, now);
      session.replaceTransaction(transaction);
      session.saveCommand({
        keyHash,
        operation: 'reverse-transaction',
        fingerprintHash,
        transaction,
        createdAt: now,
      });
      return { transaction, replayed: false };
    });
  }
}
