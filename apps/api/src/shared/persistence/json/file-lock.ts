import properLockfile from 'proper-lockfile';

import {
  DatabaseLockAcquisitionError,
  DatabaseLockCompromisedError,
} from './json-file-database.errors.ts';

export interface FileLockHandle {
  assertUsable(): void;
  release(): Promise<void>;
}

export interface FileLock {
  acquire(filePath: string): Promise<FileLockHandle>;
}

export const DATABASE_FILE_LOCK_TIMING = {
  staleMilliseconds: 5_000,
  updateMilliseconds: 1_000,
  acquisitionTimeoutMilliseconds: 10_000,
} as const;

interface FileLockDriverOptions {
  readonly staleMilliseconds: number;
  readonly updateMilliseconds: number;
  readonly acquisitionTimeoutMilliseconds: number;
  readonly onCompromised: (error: Error) => void;
}

export type FileLockDriver = (
  filePath: string,
  options: FileLockDriverOptions,
) => Promise<() => Promise<void>>;

const RETRY_DELAY_MILLISECONDS = 1_000;

const acquireWithProperLockfile: FileLockDriver = (filePath, options) =>
  properLockfile.lock(filePath, {
    stale: options.staleMilliseconds,
    update: options.updateMilliseconds,
    realpath: false,
    retries: {
      retries: Math.ceil(
        options.acquisitionTimeoutMilliseconds / RETRY_DELAY_MILLISECONDS,
      ),
      factor: 1,
      minTimeout: RETRY_DELAY_MILLISECONDS,
      maxTimeout: RETRY_DELAY_MILLISECONDS,
      randomize: false,
    },
    onCompromised: options.onCompromised,
  });

export class ProperFileLock implements FileLock {
  constructor(
    private readonly acquireLock: FileLockDriver = acquireWithProperLockfile,
  ) {}

  async acquire(filePath: string): Promise<FileLockHandle> {
    let compromisedError: DatabaseLockCompromisedError | undefined;
    let releaseLock: () => Promise<void>;

    try {
      releaseLock = await this.acquireLock(filePath, {
        ...DATABASE_FILE_LOCK_TIMING,
        onCompromised: (error) => {
          compromisedError = new DatabaseLockCompromisedError(error);
        },
      });
    } catch (error) {
      throw new DatabaseLockAcquisitionError(error);
    }

    return {
      assertUsable: () => {
        if (compromisedError) {
          throw compromisedError;
        }
      },
      release: async () => {
        try {
          await releaseLock();
        } catch (error) {
          compromisedError ??= new DatabaseLockCompromisedError(error);
        }

        if (compromisedError) {
          throw compromisedError;
        }
      },
    };
  }
}
