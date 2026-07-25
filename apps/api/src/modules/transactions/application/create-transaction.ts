import { TransactionIdGenerationError } from './errors/transaction-command.error.ts';
import { IdempotencyConflictError } from './errors/transaction-command.error.ts';
import type { TransactionCommandRepository } from './ports/transaction-command-repository.ts';
import type {
  Clock,
  StringHasher,
  TransactionIdGenerator,
} from './ports/runtime-services.ts';
import type { PendingTransaction } from '../domain/transaction.ts';

const MAX_ID_GENERATION_ATTEMPTS = 3;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateTransactionInput {
  readonly accountId: string;
  readonly idempotencyKey: string;
  readonly merchantName: string;
  readonly amount: {
    readonly minorUnits: number;
    readonly currency: 'CAD';
  };
}

export interface TransactionCommandResult {
  readonly transaction: PendingTransaction;
  readonly replayed: boolean;
}

export class CreateTransaction {
  constructor(
    private readonly repository: TransactionCommandRepository,
    private readonly clock: Clock,
    private readonly idGenerator: TransactionIdGenerator,
    private readonly hasher: StringHasher,
  ) {}

  execute(input: CreateTransactionInput): Promise<TransactionCommandResult> {
    const now = this.clock.now();
    const merchantName = input.merchantName.trim();
    const keyHash = this.hasher.hash(`idempotency-key:${input.idempotencyKey}`);
    const fingerprintHash = this.hasher.hash(
      `fingerprint:${JSON.stringify({
        operation: 'create-transaction',
        accountId: input.accountId,
        merchantName,
        amount: {
          minorUnits: input.amount.minorUnits,
          currency: input.amount.currency,
        },
      })}`,
    );

    return this.repository.transaction((session) => {
      const stored = session.findCommand(keyHash);
      if (stored !== null) {
        if (
          stored.operation !== 'create-transaction' ||
          stored.fingerprintHash !== fingerprintHash
        ) {
          throw new IdempotencyConflictError();
        }
        if (stored.transaction.status !== 'pending') {
          throw new TransactionIdGenerationError();
        }
        return { transaction: stored.transaction, replayed: true };
      }

      let id: string | undefined;
      for (
        let attempt = 0;
        attempt < MAX_ID_GENERATION_ATTEMPTS;
        attempt += 1
      ) {
        const candidate = this.idGenerator.generate();
        if (
          UUID_PATTERN.test(candidate) &&
          !session.hasTransactionId(candidate)
        ) {
          id = candidate;
          break;
        }
      }
      if (id === undefined) {
        throw new TransactionIdGenerationError();
      }

      const transaction: PendingTransaction = {
        id,
        accountId: input.accountId,
        merchantName,
        amount: { ...input.amount },
        status: 'pending',
        transactionDate: now,
        createdAt: now,
        updatedAt: now,
        reversedAt: null,
      };
      session.insertTransaction(transaction);
      session.saveCommand({
        keyHash,
        operation: 'create-transaction',
        fingerprintHash,
        transaction,
        createdAt: now,
      });
      return { transaction, replayed: false };
    });
  }
}
