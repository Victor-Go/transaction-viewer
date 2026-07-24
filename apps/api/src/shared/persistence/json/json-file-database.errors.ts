export abstract class JsonFileDatabaseError extends Error {
  protected constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = new.target.name;
  }
}

export class DatabaseLockAcquisitionError extends JsonFileDatabaseError {
  constructor(cause?: unknown) {
    super('The database file lock could not be acquired', cause);
  }
}

export class DatabaseLockCompromisedError extends JsonFileDatabaseError {
  constructor(cause?: unknown) {
    super('The database file lock was compromised', cause);
  }
}

export class DatabaseFileMissingError extends JsonFileDatabaseError {
  constructor(cause?: unknown) {
    super(
      'The database file does not exist; explicit initialization is required',
      cause,
    );
  }
}

export class DatabaseReadError extends JsonFileDatabaseError {
  constructor(cause?: unknown) {
    super('The database file could not be read', cause);
  }
}

export class MalformedDatabaseJsonError extends JsonFileDatabaseError {
  constructor(cause?: unknown) {
    super('The database file does not contain valid JSON', cause);
  }
}

export class UnsupportedDatabaseSchemaVersionError extends JsonFileDatabaseError {
  readonly expectedVersion: number;
  readonly actualVersion: unknown;

  constructor(expectedVersion: number, actualVersion: unknown) {
    super('The database file uses an unsupported schema version');
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class InvalidDatabaseDocumentError extends JsonFileDatabaseError {
  constructor(cause?: unknown) {
    super('The complete database document failed runtime validation', cause);
  }
}

export class DatabaseSerializationError extends JsonFileDatabaseError {
  constructor(cause?: unknown) {
    super('The database document could not be serialized safely', cause);
  }
}

export class DatabaseSizeLimitExceededError extends JsonFileDatabaseError {
  constructor() {
    super('The JSON database exceeds the 1 MiB limit');
  }
}

export class DatabaseSymlinkNotAllowedError extends JsonFileDatabaseError {
  constructor() {
    super('The database target must not be a symbolic link');
  }
}

export class DatabaseWriteError extends JsonFileDatabaseError {
  constructor(cause?: unknown) {
    super('The database file could not be written', cause);
  }
}

export class DatabaseReplacementError extends DatabaseWriteError {
  constructor(cause?: unknown) {
    super(cause);
    this.message = 'The database file could not be atomically replaced';
  }
}

export class AsyncTransactionCallbackError extends JsonFileDatabaseError {
  constructor() {
    super('Database transaction callbacks must be synchronous');
  }
}
