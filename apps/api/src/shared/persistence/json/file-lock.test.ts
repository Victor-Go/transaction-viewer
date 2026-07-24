import { describe, expect, it, vi } from 'vitest';

import {
  DatabaseLockAcquisitionError,
  DatabaseLockCompromisedError,
} from './json-file-database.errors.ts';
import {
  DATABASE_FILE_LOCK_TIMING,
  ProperFileLock,
  type FileLockDriver,
} from './file-lock.ts';

describe('ProperFileLock', () => {
  it('uses the centralized stale, update, and bounded acquisition timing', async () => {
    const lockFunction: FileLockDriver = vi.fn(async (_filePath, options) => {
      expect(options).toMatchObject(DATABASE_FILE_LOCK_TIMING);
      return async () => undefined;
    });
    const lock = new ProperFileLock(lockFunction);

    const handle = await lock.acquire('database.json');
    await handle.release();

    expect(lockFunction).toHaveBeenCalledOnce();
  });

  it('wraps acquisition failures without exposing the selected file path', async () => {
    const lock = new ProperFileLock(async () => {
      throw new Error('EACCES at C:\\sensitive\\database.json');
    });

    const acquisition = lock.acquire('C:\\sensitive\\database.json');

    await expect(acquisition).rejects.toBeInstanceOf(
      DatabaseLockAcquisitionError,
    );
    await expect(acquisition).rejects.not.toThrow(/sensitive/);
  });

  it('reports a compromised lock and still invokes release', async () => {
    let compromise!: (error: Error) => void;
    const release = vi.fn(async () => undefined);
    const lockFunction: FileLockDriver = async (_filePath, options) => {
      compromise = options.onCompromised;
      return release;
    };
    const lock = new ProperFileLock(lockFunction);
    const handle = await lock.acquire('database.json');

    compromise(new Error('lock heartbeat failed'));

    expect(() => handle.assertUsable()).toThrow(DatabaseLockCompromisedError);
    await expect(handle.release()).rejects.toBeInstanceOf(
      DatabaseLockCompromisedError,
    );
    expect(release).toHaveBeenCalledOnce();
  });
});
