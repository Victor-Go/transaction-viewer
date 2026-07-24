import { open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  DatabaseReplacementError,
  JsonFileDatabaseError,
} from './json-file-database.errors.ts';

type RenameFile = (oldPath: string, newPath: string) => Promise<void>;

export class AtomicFileWriter {
  constructor(private readonly renameFile: RenameFile = rename) {}

  async replace(
    filePath: string,
    contents: string,
    beforeRename: () => void = () => undefined,
  ): Promise<void> {
    const temporaryPath = path.join(
      path.dirname(filePath),
      `${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
    );
    let fileHandle: Awaited<ReturnType<typeof open>> | undefined;

    try {
      fileHandle = await open(temporaryPath, 'wx', 0o600);
      await fileHandle.writeFile(contents, 'utf8');
      await fileHandle.sync();
      await fileHandle.close();
      fileHandle = undefined;
      beforeRename();
      await this.renameFile(temporaryPath, filePath);
    } catch (error) {
      if (error instanceof JsonFileDatabaseError) {
        throw error;
      }
      throw new DatabaseReplacementError(error);
    } finally {
      if (fileHandle) {
        await fileHandle.close().catch(() => undefined);
      }
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}
