import { lstat, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';

import {
  DatabaseFileMissingError,
  DatabaseReadError,
  DatabaseSymlinkNotAllowedError,
  DatabaseWriteError,
} from './json-file-database.errors.ts';

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && 'code' in error;

export const assertDatabaseTargetIsNotSymlink = async (
  targetPath: string,
): Promise<void> => {
  try {
    if ((await lstat(targetPath)).isSymbolicLink()) {
      throw new DatabaseSymlinkNotAllowedError();
    }
  } catch (error) {
    if (error instanceof DatabaseSymlinkNotAllowedError) {
      throw error;
    }
    if (isNodeError(error) && error.code === 'ENOENT') {
      return;
    }
    throw new DatabaseReadError(error);
  }
};

export const resolveCanonicalDatabasePath = async (
  configuredPath: string,
  createParentDirectory: boolean,
): Promise<string> => {
  const absolutePath = path.resolve(configuredPath);
  const parentDirectory = path.dirname(absolutePath);

  if (createParentDirectory) {
    try {
      await mkdir(parentDirectory, { recursive: true });
    } catch (error) {
      throw new DatabaseWriteError(error);
    }
  }

  let canonicalParent: string;
  try {
    canonicalParent = await realpath(parentDirectory);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new DatabaseFileMissingError(error);
    }
    throw new DatabaseReadError(error);
  }

  const targetPath = path.join(canonicalParent, path.basename(absolutePath));
  await assertDatabaseTargetIsNotSymlink(targetPath);
  return targetPath;
};
