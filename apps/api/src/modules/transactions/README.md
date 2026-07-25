# Transactions

Application-owned repository ports are the replaceable persistence boundaries:

```text
ListTransactions ─┐
GetTransaction  ──┴─> TransactionRepository
                         └─> JsonTransactionRepository
                               └─> JsonFileDatabase

CreateTransaction ─────┐
ReverseTransaction ────┼─> TransactionCommandRepository
PostPendingTransactions┘      └─> JsonTransactionCommandRepository
                                  └─> JsonFileDatabase
```

The JSON adapter reads the latest committed collection on every request, then
performs transaction-specific account/status/date filtering, exact counting,
ordering, and keyset pagination in memory. `JsonFileDatabase` deliberately has
no transaction, sorting, counting, or pagination knowledge. A future relational
adapter must preserve the same public semantics with indexed queries.

Ordering is fixed to `transactionDate` descending and then `id` descending.
Both cursor keys are immutable. Cursors are opaque, versioned base64url values
scoped to account ID, normalized status scope, and normalized UTC `from`/`to`
scope. They are validation and continuation tokens, not an authorization
boundary.

List date filtering requires both UTC instants or neither. It includes
`transactionDate >= from` and excludes `transactionDate >= to`. Counting occurs
after the account, status, and date predicates and before cursor/page slicing.

Pages do not share snapshot isolation. Each page observes the latest committed
file, so `totalCount` can change between requests. Keyset pagination prevents
newer head inserts from shifting the continuation boundary, but status changes
or changes to cursor keys could affect cross-request results.

The deterministic demo generator creates exactly 50 records: 45 for
`acc_demo` (15 pending, 15 posted, 15 reversed) and 5 for `acc_secondary`.
Tests always use temporary database files and never mutate committed demo data.
Only the default database is seeded implicitly; an explicitly selected file is
initialized empty unless `--seed-demo` is supplied.

Status changes use the explicit Domain transition table `pending -> posted`,
`posted -> reversed`, and terminal `reversed`. Named operations retain their
additional timing guards; no generic status mutation is exposed.

Write commands persist an idempotency record only when their mutation succeeds.
Rejected commands throw before `saveCommand`, so the JSON transaction aborts
without consuming the key. A successful mutation and its idempotency record are
validated and atomically replaced together.

Each API process owns its scheduler instance. Reconciliation is repeatable and
atomic, process-local overlap is skipped, and the shared-file lock serializes
processes that use the same physical JSON file. This is not scheduler
leadership; a production deployment would normally run the use case through a
dedicated worker or distributed job mechanism.
