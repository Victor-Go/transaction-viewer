export class IdempotencyConflictError extends Error {
  constructor() {
    super('The idempotency key was already used for another command');
    this.name = 'IdempotencyConflictError';
  }
}

export class TransactionNotFoundError extends Error {
  constructor() {
    super('Transaction was not found');
    this.name = 'TransactionNotFoundError';
  }
}

export class TransactionIdGenerationError extends Error {
  constructor() {
    super('A unique transaction ID could not be generated');
    this.name = 'TransactionIdGenerationError';
  }
}
