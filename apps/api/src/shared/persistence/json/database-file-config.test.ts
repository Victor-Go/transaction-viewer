import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseDatabaseFileConfig } from './database-file-config.ts';

const dataDirectory = path.resolve('apps/api/data');

describe('parseDatabaseFileConfig', () => {
  it('prefers the command-line database file over the environment', () => {
    const result = parseDatabaseFileConfig({
      argv: ['--database-file', 'cli.json'],
      env: { DATABASE_FILE: 'environment.json' },
      dataDirectory,
    });

    expect(result.databaseFile).toBe(path.join(dataDirectory, 'cli.json'));
  });

  it('uses DATABASE_FILE when the command-line option is absent', () => {
    const result = parseDatabaseFileConfig({
      argv: [],
      env: { DATABASE_FILE: 'environment.json' },
      dataDirectory,
    });

    expect(result.databaseFile).toBe(
      path.join(dataDirectory, 'environment.json'),
    );
  });

  it('uses default.json when neither configured source is present', () => {
    const result = parseDatabaseFileConfig({
      argv: [],
      env: {},
      dataDirectory,
    });

    expect(result.databaseFile).toBe(path.join(dataDirectory, 'default.json'));
  });

  it('normalizes relative paths and preserves deterministic absolute paths', () => {
    const relativeResult = parseDatabaseFileConfig({
      argv: ['--database-file=instances/../development.json'],
      env: {},
      dataDirectory,
    });
    const absoluteFile = path.resolve('temporary/database.json');
    const absoluteResult = parseDatabaseFileConfig({
      argv: ['--database-file', absoluteFile],
      env: {},
      dataDirectory,
    });

    expect(relativeResult.databaseFile).toBe(
      path.join(dataDirectory, 'development.json'),
    );
    expect(absoluteResult.databaseFile).toBe(absoluteFile);
  });

  it.each([
    ['missing value', ['--database-file']],
    ['empty equals value', ['--database-file=']],
    ['option in place of a value', ['--database-file', '--other-option']],
    [
      'duplicate option',
      ['--database-file', 'one.json', '--database-file=two.json'],
    ],
  ])('rejects a %s clearly', (_description, argv) => {
    expect(() =>
      parseDatabaseFileConfig({ argv, env: {}, dataDirectory }),
    ).toThrow(/--database-file/);
  });
});
