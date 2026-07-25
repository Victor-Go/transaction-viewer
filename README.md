# Card Platform

A full-stack TypeScript monorepo for an extensible card platform. The transaction viewer will be the first business module, while the repository boundaries are designed to support additional card-platform capabilities.

## Requirements

- Node.js 24
- pnpm 11.9.0

## Workspaces

- `@card-platform/api` — Express 5 API application
- `@card-platform/web` — React and Vite web application
- `@card-platform/contracts` — shared Zod HTTP contracts

## Commands

```sh
pnpm dev
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify
```

`pnpm verify` checks formatting, linting, types, unit/integration tests, and builds. Playwright tests remain separate under `tests/e2e`.

## Architecture

API business modules live under `apps/api/src/modules`. A module may contain `domain`, `application`, `infrastructure`, and `http` layers as it gains real behavior. Only external HTTP contracts shared by applications belong in `packages/contracts`.

The web application is feature-oriented. Transaction-specific API access, state, and UI will live under `features/transactions`; transport-level Fetch behavior belongs under `shared/api`.

## Transaction API

The API listens on port `3000` by default and preserves the independent
`GET /health` endpoint.

`GET /api/v1/accounts/:accountId/transactions` returns a read-only,
keyset-paginated transaction list. It accepts optional `status` (`pending`,
`posted`, or `reversed`), `pageSize` (default 20, maximum 100), and opaque
`pageToken` query parameters. Clients must return `nextPageToken` unchanged and
must not interpret it.

Results are always ordered by `transactionDate` descending and then `id`
descending. Response metadata contains `pageSize`, `returnedCount`,
`totalCount`, `hasMore`, and `nextPageToken`. `totalCount` is calculated after
account/status filtering and before cursor/page slicing.

Each request reads the latest committed JSON file; page requests do not share
snapshot isolation and `totalCount` may change between them. Head insertions do
not shift an existing keyset boundary, but changes to status or the immutable
cursor keys (`transactionDate` and `id`) could affect continuation results.

`GET /api/v1/accounts/:accountId/transactions/:transactionId` returns one
transaction in the same public shape. A missing transaction and a transaction
owned by another account both return `TRANSACTION_NOT_FOUND`; the endpoint does
not reveal cross-account existence.

Every returned transaction also contains:

- `canReverse`, a snapshot calculated using server time.
- `reverseExpiresAt`, the absolute UTC instant exactly 31 × 24 hours after
  `transactionDate`.

### Create Transaction

`POST /api/v1/accounts/:accountId/transactions` simulates a CAD purchase. It
requires a unique `Idempotency-Key` header and a strict request body:

```json
{
  "merchantName": "Northern Grocer",
  "amount": {
    "minorUnits": 2599,
    "currency": "CAD"
  }
}
```

The API returns `201 Created`, a `Location` header that resolves through the
single-transaction GET endpoint, and:

```json
{
  "data": {
    "id": "7fa4e959-a1e8-4fe2-a632-e07c8fdbfbbb",
    "accountId": "acc_demo",
    "merchantName": "Northern Grocer",
    "amount": { "minorUnits": 2599, "currency": "CAD" },
    "status": "pending",
    "transactionDate": "2026-05-10T12:00:00.000Z",
    "createdAt": "2026-05-10T12:00:00.000Z",
    "updatedAt": "2026-05-10T12:00:00.000Z",
    "reversedAt": null,
    "canReverse": false,
    "reverseExpiresAt": "2026-06-10T12:00:00.000Z"
  }
}
```

Identity, account, status, and lifecycle fields are server-controlled. New
transactions begin pending. Each API process starts one five-second
reconciliation scheduler that posts pending transactions at least five seconds
old, so the expected visible pending period is approximately 5–10 seconds.
Startup reconciliation also catches up eligible records left during downtime.

### Reverse Transaction

`POST /api/v1/accounts/:accountId/transactions/:transactionId/reversal`
requires an `Idempotency-Key` header and either no body or `{}`. Only posted
transactions can be reversed, and the backend rechecks an exact rolling
31 × 24-hour window from `transactionDate`. Reversal is allowed exactly at the
deadline and rejected afterward.

A successful reversal returns `200 OK`:

```json
{
  "data": {
    "id": "7fa4e959-a1e8-4fe2-a632-e07c8fdbfbbb",
    "accountId": "acc_demo",
    "merchantName": "Northern Grocer",
    "amount": { "minorUnits": 2599, "currency": "CAD" },
    "status": "reversed",
    "transactionDate": "2026-05-10T12:00:00.000Z",
    "createdAt": "2026-05-10T12:00:00.000Z",
    "updatedAt": "2026-05-11T12:00:00.000Z",
    "reversedAt": "2026-05-11T12:00:00.000Z",
    "canReverse": false,
    "reverseExpiresAt": "2026-06-10T12:00:00.000Z"
  }
}
```

Write errors use stable codes: malformed requests return `INVALID_REQUEST`,
missing transactions return `TRANSACTION_NOT_FOUND`, ineligible status returns
`TRANSACTION_NOT_POSTED` or `TRANSACTION_ALREADY_REVERSED`, expired windows
return `REVERSAL_WINDOW_EXPIRED`, and incompatible key reuse returns
`IDEMPOTENCY_CONFLICT`.

### Transaction state machine

The explicit structural state machine is:

```text
pending → posted
posted → reversed
reversed → terminal
```

The state table is only the structural permission. Pending-to-posted also
requires the five-second posting-delay guard, and posted-to-reversed also
requires the exact reversal-window guard. The API exposes named Create and
Reverse operations; it does not expose arbitrary status updates or a generic
status PATCH endpoint.

### Idempotency

Idempotency records are persisted only for successful state-changing commands.
Validation failures and business-rule rejections do not consume the
`Idempotency-Key`. Once a command succeeds, retries using the same key and
normalized request replay the original successful response without repeating
the mutation. Reusing a key after success for a different normalized command
returns `IDEMPOTENCY_CONFLICT`.

For example, reversing a pending transaction is rejected with
`TRANSACTION_NOT_POSTED` and does not store the key. After reconciliation posts
the transaction, the same reversal and key may succeed; only that successful
reversal persists the key, and later identical retries replay the successful
result.

Keys are SHA-256 hashed and retained persistently in the selected JSON
database. Successful mutation and idempotency-record insertion are committed
in one atomic database transaction. Records are retained indefinitely for this
Assignment and therefore contribute to the database's fixed size limit.

For a future frontend, effective eligibility must fail closed:

```text
effectiveCanReverse =
  transaction.canReverse
  AND localCurrentTime <= transaction.reverseExpiresAt
  AND reverseExpiresAt parses successfully
```

The UI should convert the UTC deadline to local time, describe when reversal
expires, and disable reversal when the local clock passes it without requiring
a reload. The backend remains authoritative.

## JSON database and demo data

The API uses the selected JSON document with `metadata.schemaVersion`,
`collections.transactions`, and `collections.idempotency`. This intentionally
small adapter filters, counts, sorts, and paginates transaction reads in memory
and is not a production database.

Database-file precedence is:

1. `--database-file`
2. `DATABASE_FILE`
3. `apps/api/data/default.json`

On first development startup, the missing default path is generated with
exactly 50 deterministic demo transactions: 45 for `acc_demo` (15 per status)
and 5 for `acc_secondary`. Their deterministic timeline starts at
`2026-05-01T00:00:00.000Z` and advances with fixed-seed intervals no longer
than 24 hours. Runtime `apps/api/data/*.json` files are intentionally ignored
by Git; the generator is the source of truth. Existing valid files are never
overwritten. Explicitly
selected files initialize empty for safety unless demo data is explicitly
requested:

```sh
pnpm --filter @card-platform/api dev
pnpm --filter @card-platform/api dev -- --database-file development.json
pnpm --filter @card-platform/api dev -- --database-file demo.json --seed-demo
DATABASE_FILE=deployment.json pnpm --filter @card-platform/api dev
```

Demo initialization is idempotent. Arbitrary selected files never receive demo
data merely because of `NODE_ENV`.

Every API process may start its own recurring scheduler. Each scheduler
attempts the same state-based, repeatable reconciliation: it selects only
pending records older than the threshold, and selection plus updates occur in
one atomic database transaction. A process-local guard prevents overlapping
ticks in that process. The shared JSON-file lock serializes mutations between
processes using the same physical file; after one process posts eligible
records, another normally rereads the committed state and performs a no-op.

This is not exactly-once scheduling, distributed leadership, or production
worker coordination. Production replicas would normally delegate this
Application use case to a dedicated worker, distributed job owner, or durable
queue. The file lock coordinates only processes accessing the same physical
filesystem; separate container-local JSON files are not a shared production
database. The scheduler demonstrates reconciliation for this constrained
Assignment and is not a payment network or settlement processor.

## Structured logging

The API emits structured JSON logs through Pino to stdout. `LOG_LEVEL` controls
filtering and defaults to `info`; the runtime or deployment platform is
responsible for log collection and persistence. Sensitive tokens and
credentials are redacted, and the application does not create local log files.
Logs exclude transaction records, account IDs, merchant names, amounts, cursor
payloads, complete database contents, and absolute database paths.
