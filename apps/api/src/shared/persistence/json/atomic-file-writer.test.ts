import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AtomicFileWriter } from './atomic-file-writer.ts';
import {
  DatabaseLockCompromisedError,
  DatabaseReplacementError,
} from './json-file-database.errors.ts';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'atomic-json-test-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('AtomicFileWriter', () => {
  it('replaces a file through a same-directory temporary file and cleans it', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = path.join(directory, 'database.json');
    await writeFile(filePath, 'old contents', 'utf8');

    await new AtomicFileWriter().replace(filePath, 'new contents');

    expect(await readFile(filePath, 'utf8')).toBe('new contents');
    expect(await readdir(directory)).toEqual(['database.json']);
  });

  it('cleans the temporary file when replacement fails', async () => {
    const directory = await createTemporaryDirectory();
    const targetDirectory = path.join(directory, 'database.json');
    await mkdir(targetDirectory);

    await expect(
      new AtomicFileWriter().replace(targetDirectory, 'new contents'),
    ).rejects.toBeInstanceOf(DatabaseReplacementError);

    expect(await readdir(directory)).toEqual(['database.json']);
  });

  it('preserves an existing file when the rename operation fails', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = path.join(directory, 'database.json');
    await writeFile(filePath, 'committed contents', 'utf8');
    const writer = new AtomicFileWriter(async () => {
      throw new Error('simulated rename failure');
    });

    await expect(
      writer.replace(filePath, 'uncommitted contents'),
    ).rejects.toBeInstanceOf(DatabaseReplacementError);

    expect(await readFile(filePath, 'utf8')).toBe('committed contents');
    expect(await readdir(directory)).toEqual(['database.json']);
  });

  it('preserves a classified lock-compromise error thrown before rename', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = path.join(directory, 'database.json');
    const committedContents = Buffer.from('committed contents');
    await writeFile(filePath, committedContents);
    const renameFile = vi.fn(async () => undefined);
    const writer = new AtomicFileWriter(renameFile);
    const cause = new Error('lock heartbeat failed');
    const compromised = new DatabaseLockCompromisedError(cause);

    const replacement = writer.replace(filePath, 'uncommitted contents', () => {
      const temporaryEntry = readdirSync(directory).find(
        (entry) => entry !== 'database.json',
      );
      expect(temporaryEntry).toBeDefined();
      expect(readFileSync(path.join(directory, temporaryEntry!), 'utf8')).toBe(
        'uncommitted contents',
      );
      throw compromised;
    });

    await expect(replacement).rejects.toBe(compromised);
    await expect(replacement).rejects.not.toBeInstanceOf(
      DatabaseReplacementError,
    );
    expect(compromised.cause).toBe(cause);
    expect(await readFile(filePath)).toEqual(committedContents);
    expect(await readdir(directory)).toEqual(['database.json']);
    expect(renameFile).not.toHaveBeenCalled();
  });
});
