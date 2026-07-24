import path from 'node:path';

export interface DatabaseFileConfig {
  readonly databaseFile: string;
}

export interface DatabaseFileConfigInput {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly dataDirectory: string;
}

const readCommandLineValue = (argv: readonly string[]): string | undefined => {
  const values: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--database-file') {
      const value = argv[index + 1];
      if (
        value === undefined ||
        value.startsWith('--') ||
        value.trim() === ''
      ) {
        throw new Error('--database-file requires a non-empty path argument');
      }
      values.push(value);
      index += 1;
      continue;
    }

    if (argument?.startsWith('--database-file=')) {
      const value = argument.slice('--database-file='.length);
      if (value.trim() === '') {
        throw new Error('--database-file requires a non-empty path argument');
      }
      values.push(value);
    }
  }

  if (values.length > 1) {
    throw new Error('--database-file may be specified only once');
  }

  return values[0];
};

const resolveFromDataDirectory = (
  configuredPath: string,
  dataDirectory: string,
): string =>
  path.normalize(
    path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(dataDirectory, configuredPath),
  );

export const parseDatabaseFileConfig = ({
  argv,
  env,
  dataDirectory,
}: DatabaseFileConfigInput): DatabaseFileConfig => {
  const commandLineValue = readCommandLineValue(argv);
  const environmentValue = env.DATABASE_FILE;

  if (
    commandLineValue === undefined &&
    environmentValue !== undefined &&
    environmentValue.trim() === ''
  ) {
    throw new Error('DATABASE_FILE must be a non-empty path when provided');
  }

  const configuredPath = commandLineValue ?? environmentValue ?? 'default.json';

  return {
    databaseFile: resolveFromDataDirectory(configuredPath, dataDirectory),
  };
};
