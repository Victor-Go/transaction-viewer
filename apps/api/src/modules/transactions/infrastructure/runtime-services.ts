import { createHash, randomUUID } from 'node:crypto';

import type {
  Clock,
  StringHasher,
  TransactionIdGenerator,
} from '../application/ports/runtime-services.ts';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class CryptoTransactionIdGenerator implements TransactionIdGenerator {
  generate(): string {
    return randomUUID();
  }
}

export class Sha256StringHasher implements StringHasher {
  hash(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }
}
