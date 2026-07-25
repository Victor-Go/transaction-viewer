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

## Local development

Install dependencies and run both applications:

```sh
pnpm install
pnpm dev
```

The API runs at `http://127.0.0.1:3000` and Vite runs at
`http://127.0.0.1:5173`. Vite proxies `/api` to the API. The default generated
demo account is `acc_demo`.

## Transaction web experience

Available browser routes:

- `/` redirects to `/accounts/acc_demo/transactions`.
- `/accounts/:accountId/transactions` renders Transaction History.
- `/accounts/:accountId/transactions/:transactionId` keeps History mounted and
  opens a route-driven Transaction Detail overlay.

History is date-unbounded by default and begins with the newest Transactions.
All omits the `status` query parameter; Pending, Posted, and Reversed
synchronize a lowercase `status` search parameter. Search by Date opens with an
empty draft unless a range is already applied. Calendar selection and
month/year navigation stay local and issue no request until Search is
activated. Start and End are read-only localized summaries. The first click
sets Start, the second normalizes and completes the range (including one-day
ranges), and the next click after completion starts a new range.

Search stores inclusive local `fromDate`/`toDate` calendar dates in the URL,
preserves the status filter, discards loaded pages and the old cursor, and
requests one new first page. An applied localized range replaces Search by Date
and is paired with a separate Clear control. Clear removes only the date
parameters, preserves status, drops the date-scoped cursor and rows, and
requests one unbounded first page. The calendar always renders six real weeks;
valid preceding- and following-month dates are visible and selectable. Selecting
one of those adjacent dates keeps the current month heading and grid in place;
only the previous/next month and previous/next year step buttons navigate the
calendar. Direct month/year dropdowns are intentionally omitted to keep the
take-home interaction focused. Applied current-year ranges omit years, ranges
within one historical year show it once, and cross-year ranges show both years.

At the API boundary, the local start midnight and the midnight after the
inclusive end are serialized as UTC `[from, to)` instants. Keyset pagination
uses Load more and returns each opaque `nextPageToken` unchanged. Confirmed
Create and status/reversal updates reconcile against the complete active
status-and-date query rather than status alone. Search controls, empty states,
applied ranges, dates, and accessible names are presented in English or French
using `en-CA` or `fr-CA`.

Create Transaction is a programmatic overlay rather than a route. It accepts a
merchant and an exactly parsed CAD amount, sends only the strict shared request
contract, generates an in-memory frontend `Idempotency-Key`, and reuses that
key when a network or server outcome is uncertain. Success reconciles the new
Pending purchase into History and navigates to its Detail route. Response
`Location` values never cause external navigation.

Detail uses the account-scoped single-resource endpoint. Dates, timestamps,
and the reversal deadline display in the user's local timezone. An eligible
Posted transaction can open a nested destructive AlertDialog. The frontend
fails closed when `canReverse` is false, the deadline is invalid, or the local
clock passes the deadline; the backend remains authoritative. Reversal is not
optimistic, and a successful response supplies the final status and
timestamps.

The application follows the system light/dark preference without storing a
user theme. Customer UI is available in English and French. A saved language
choice overrides browser detection; regional locales normalize to English or
French, unsupported locales fall back to English, and display formatting uses
`en-CA` or `fr-CA`. Below 40rem, the same accessible overlay panel DOM is presented as
a safe-area-aware Bottom Sheet; at and above 40rem it is a centered Modal.
Radix Dialog and AlertDialog provide focus trapping, focus restoration,
Escape handling, accessible naming, and background interaction blocking.
Reduced-motion preferences are respected.

Plain CSS owns Tailwind's entry, reset, theme, color, z-index, and motion
tokens. Tailwind handles straightforward layout and spacing; component-local
SCSS Modules handle glass surfaces, complex state, and the responsive
Modal-to-Bottom-Sheet morph. Solid fallbacks remain readable when backdrop blur
is unavailable.

The short Pending-to-Posted transition and two-second client polling are
take-home demonstration mechanisms. They make asynchronous state changes
visible during a short review session and do not represent real
payment-network posting times or the preferred production notification
architecture.

Specifically, the backend's five-second eligibility threshold is reconciled by
a five-second scheduler, producing an approximately 5–10-second visible demo
period. Only an open Pending Detail polls every two seconds. Production could
use event-driven refresh, server push, durable messaging, or another
coordinated background mechanism instead.

## Architecture

API business modules live under `apps/api/src/modules`. A module may contain `domain`, `application`, `infrastructure`, and `http` layers as it gains real behavior. Only external HTTP contracts shared by applications belong in `packages/contracts`.

The web application is feature-oriented. Transaction-specific API access,
state, and UI live under `features/transactions`; transport-level Fetch
behavior belongs under `shared/api`. The unified overlay controller lives under
`shared/overlays`, while the application layer maps its typed overlay requests
to feature content. See
[`docs/architecture/frontend-transactions.md`](docs/architecture/frontend-transactions.md).

## Transaction API

The API listens on port `3000` by default and preserves the independent
`GET /health` endpoint.

`GET /api/v1/accounts/:accountId/transactions` returns a read-only,
keyset-paginated transaction list. It accepts optional `status` (`pending`,
`posted`, or `reversed`), `pageSize` (default 20, maximum 100), opaque
`pageToken`, and paired UTC `from`/`to` query parameters. `from` is inclusive,
`to` is exclusive, both dates are required together, and `from` must precede
`to`. Clients must return `nextPageToken` unchanged and must not interpret it.

Results are always ordered by `transactionDate` descending and then `id`
descending. Response metadata contains `pageSize`, `returnedCount`,
`totalCount`, `hasMore`, and `nextPageToken`. `totalCount` is calculated after
account/status/date filtering and before cursor/page slicing. Cursors are
scoped to the complete account, status, and applied-date query.

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

## Production limitations and AI usage

This take-home intentionally omits authentication, authorization, account
selection, real payment processing, production notifications, analytics,
distributed scheduling, database-backed querying, and manual theme selection.
JSON persistence, short posting timing, and client polling are demonstration
constraints rather than production recommendations.

AI assistance was used to interpret the complete frontend vertical-slice
requirements, plan architecture and tests, implement the typed API/overlay/UI
boundaries, and record actual verification. The durable decisions and
Red-to-Green evidence are maintained in `PROMPTS.md`; the source tree, shared
contracts, and executed checks remain the authority.
