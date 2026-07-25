export interface Clock {
  now(): Date;
}

export interface TransactionIdGenerator {
  generate(): string;
}

export interface StringHasher {
  hash(value: string): string;
}
