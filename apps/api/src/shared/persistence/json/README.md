# Transactional JSON File Storage

`JsonFileDatabase` is an API-infrastructure utility for repository adapters. It
is not an application or domain abstraction, and application and domain code
must not import it. Repository ports remain the replaceable persistence
boundary.

## Document and API

Every file is one complete JSON document:

```json
{
  "metadata": {
    "schemaVersion": 1
  },
  "collections": {}
}
```

The caller supplies a runtime schema that validates this entire document. The
typed collection shape drives `find`, `findOne`, `insert`, `updateWhere`, and
the synchronous `transaction` context. Initialization is explicit and receives
a complete initial document; normal reads never invent data when the file is
missing.

Read operations load and validate the latest complete file but do not take
either write lock. Same-directory atomic replacement means a reader observes
the previous complete file or the replacement complete file, not an
incrementally written target. Returned records are defensive copies.

Persisted documents are limited to 1 MiB (1,048,576 UTF-8 bytes). Existing
files are size-checked before their complete contents are read. Before commit,
the validated working document must contain only JSON-safe values, survive
serialization and parsing, pass the runtime schema again, and remain deeply
equivalent to the intended document. Values such as non-finite numbers,
`undefined`, `bigint`, functions, symbols, cycles, dates, and other non-plain
objects are rejected rather than silently changed.

## Mutation and locking guarantees

The configured path is made absolute, its parent is resolved with `realpath`,
and the original basename is joined to that canonical parent. This canonical
target identifies reads, writes, initialization, the process-local mutex, and
the file lock. A target file that is itself a symbolic link is rejected;
symlinked parent directories are allowed after canonicalization.

Every mutation:

1. takes the process-local mutex keyed by the canonical selected file path;
2. takes `proper-lockfile` for that same path;
3. reads and validates the latest committed document;
4. mutates an isolated working copy through a synchronous transaction context;
5. validates the complete result and skips the write when it is unchanged;
   changed results must also pass the JSON round-trip and UTF-8 size checks;
6. writes deterministic, two-space-indented JSON to a unique same-directory
   temporary file, flushes and closes it, then renames it over the target;
7. removes any remaining temporary file and attempts to release the file lock,
   while the process-local mutex is always released by its finally-based queue
   cleanup.

This provides atomic replacement of one JSON file, serialized mutation within
one process, cross-process exclusion for cooperating processes using the same
file path, and rollback by withholding the working copy when mutation or
validation fails. Different selected files use different mutexes and lock
paths.

Transaction callbacks must remain synchronous and side-effect free. They must
not perform network calls, filesystem calls, timers, or other external work;
those effects cannot be rolled back. A thrown callback error aborts without
commit. Promise-like callback results are rejected immediately and are never
awaited or committed.

`proper-lockfile` uses centralized timing: a 5-second stale threshold, a
1-second heartbeat update, and an approximately 10-second bounded acquisition
window. In this take-home implementation, a successful atomic replacement (or
successful no-op) determines the caller-visible mutation result. A later lock
release failure is not surfaced to the caller and can temporarily delay another
mutation until stale-lock recovery. This is a deliberate take-home
simplification, not production database transaction semantics.

This component does **not** provide multiple-file atomicity, distributed
transactions, database isolation levels, coordination between machines using
independent local filesystems, or durability guarantees equivalent to a
production database. It is not a production database lock manager. In
particular, flushing the temporary file does not imply that every filesystem or
storage device has durably persisted the containing-directory rename.

## File selection

`parseDatabaseFileConfig` uses this precedence:

1. `--database-file`
2. `DATABASE_FILE`
3. `default.json`

Relative values resolve under the injected API data directory; absolute values
remain absolute. This supports commands such as:

```text
pnpm --filter @card-platform/api dev -- --database-file development.json
```

`DATABASE_FILE` is deployment configuration, not HTTP input. A future real
database adapter would receive an independently injected `DATABASE_URL` (or
equivalent connection configuration); this JSON configuration parser does not
add or interpret `DATABASE_URL`.

All storage errors are typed internal infrastructure errors. They are not
public API error codes and must not expose paths or raw filesystem details
outside the infrastructure boundary.
