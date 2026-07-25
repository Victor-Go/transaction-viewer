import { TransactionNotFoundError } from './errors/transaction-command.error.ts';
import type { TransactionRepository } from './ports/transaction-repository.ts';
import type { Transaction } from '../domain/transaction.ts';

export interface GetTransactionInput {
  readonly accountId: string;
  readonly transactionId: string;
}

export class GetTransaction {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(input: GetTransactionInput): Promise<Transaction> {
    const transaction = await this.transactionRepository.findByAccountAndId(
      input.accountId,
      input.transactionId,
    );
    if (transaction === null) {
      throw new TransactionNotFoundError();
    }
    return transaction;
  }
}
