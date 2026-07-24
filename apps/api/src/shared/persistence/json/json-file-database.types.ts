export interface JsonDatabaseMetadata {
  readonly schemaVersion: number;
}

export type CollectionMap<Collections> = {
  [Name in keyof Collections]: readonly unknown[];
};

export interface JsonDatabaseDocument<
  Collections extends CollectionMap<Collections>,
> {
  readonly metadata: JsonDatabaseMetadata;
  readonly collections: Collections;
}

export type CollectionName<Collections> = Extract<keyof Collections, string>;

export type CollectionRecord<
  Collections,
  Name extends keyof Collections,
> = Collections[Name] extends readonly (infer Record)[] ? Record : never;

export interface UpdateWhereResult<Record> {
  readonly matchedCount: number;
  readonly updatedRecords: Record[];
}

export interface JsonDatabaseTransaction<
  Collections extends CollectionMap<Collections>,
> {
  find<Name extends CollectionName<Collections>>(
    collectionName: Name,
    predicate?: (record: CollectionRecord<Collections, Name>) => boolean,
  ): CollectionRecord<Collections, Name>[];

  findOne<Name extends CollectionName<Collections>>(
    collectionName: Name,
    predicate: (record: CollectionRecord<Collections, Name>) => boolean,
  ): CollectionRecord<Collections, Name> | null;

  insert<Name extends CollectionName<Collections>>(
    collectionName: Name,
    record: CollectionRecord<Collections, Name>,
  ): CollectionRecord<Collections, Name>;

  updateWhere<Name extends CollectionName<Collections>>(
    collectionName: Name,
    predicate: (record: CollectionRecord<Collections, Name>) => boolean,
    updater: (
      record: CollectionRecord<Collections, Name>,
    ) => CollectionRecord<Collections, Name>,
  ): UpdateWhereResult<CollectionRecord<Collections, Name>>;
}

export interface DatabaseInitializationResult {
  readonly created: boolean;
}
