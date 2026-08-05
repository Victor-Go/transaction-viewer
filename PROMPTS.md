## Initialization Prompts

```
Initialize a full-stack TypeScript monorepo in the current directory.

The repository represents an extensible card platform. The transaction viewer
is only the first business module, not the architectural boundary of the entire
project.

For this task, only initialize the repository structure, workspace packages,
development tooling, and minimal application shells.

Do not implement transaction business logic, API endpoints, JSON persistence,
forms, transaction tables, filtering, or reversal behavior yet.

## Technology stack

Use:

- Node.js 24
- pnpm workspaces
- TypeScript with strict mode
- ESM modules
- React with Vite
- Express 5
- Zod for shared HTTP contracts
- Native Fetch API for future frontend API calls
- CSS Modules
- Vitest
- Supertest
- React Testing Library
- @testing-library/user-event
- MSW
- Playwright
- ESLint
- Prettier

## Workspace structure

Create three private pnpm workspace packages:

- @card-platform/api
- @card-platform/web
- @card-platform/contracts

Use this directory structure:

.
├── apps/
│   ├── api/
│   │   ├── data/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   └── transactions/
│   │   │   ├── shared/
│   │   │   │   └── http/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── App.tsx
│       │   │   └── main.tsx
│       │   ├── features/
│       │   │   └── transactions/
│       │   │       ├── api/
│       │   │       ├── model/
│       │   │       └── ui/
│       │   └── shared/
│       │       ├── api/
│       │       └── ui/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── contracts/
│       ├── src/
│       │   ├── common/
│       │   ├── transactions/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── tests/
│   └── e2e/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
├── playwright.config.ts
├── .gitignore
└── README.md

Do not create separate workspace packages for:

- transaction domain
- JSON persistence
- test utilities
- UI components

The transaction domain belongs inside:

apps/api/src/modules/transactions/domain

Create a separate package only when code has a real cross-application consumer.
For now, only HTTP contracts are shared between the API and web applications.

## Architecture boundaries

Use the following intended API module structure:

domain/
- Business entities, value objects, rules, and domain errors
- Must not depend on Express, HTTP, JSON files, React, or Zod contracts

application/
- Transaction use cases
- Must not depend on Express Request or Response objects

infrastructure/
- Repository implementations and external infrastructure
- JSON persistence will be added later

http/
- Express routes, request mapping, response mapping, and HTTP error mapping

The API application should eventually follow:

HTTP route
  -> application use case
  -> domain
  -> repository abstraction
  -> infrastructure implementation

The web application should use feature-oriented organization:

features/transactions/api
- Transaction-specific API functions

features/transactions/model
- Hooks and UI state

features/transactions/ui
- React components for the transaction feature

shared/api
- Generic typed Fetch client and transport-level errors

shared/ui
- Reusable UI components only when genuine reuse exists

The contracts package should contain only shared external HTTP contracts:

- Zod request schemas
- Zod response schemas
- API DTOs
- Query schemas
- Common API error schemas

It must not contain:

- Express code
- React code
- backend domain rules
- repository implementations
- application use cases

## Basic configuration

Configure:

- TypeScript strict mode across all workspaces
- ESM across all workspaces
- CSS Modules support through Vite
- Vitest for API, web, and contracts
- jsdom for web tests
- Supertest support for API integration tests
- React Testing Library setup
- MSW setup for future frontend API tests
- Playwright configuration using tests/e2e

Keep these API entry-point responsibilities separate:

- app.ts creates and exports the Express application
- server.ts starts the HTTP listener

Do not start the server when app.ts is imported by tests.

## Root scripts

Add root commands for:

- pnpm dev
- pnpm lint
- pnpm format
- pnpm format:check
- pnpm typecheck
- pnpm test
- pnpm test:e2e
- pnpm build
- pnpm verify

The root scripts should delegate to workspace scripts using pnpm workspace
commands. Do not add Nx or Turborepo task orchestration.

`pnpm verify` should run:

1. format:check
2. lint
3. typecheck
4. test
5. build

Keep Playwright E2E tests separate from the standard verify command.

## Minimal application shells

Create only enough code to verify that:

- The Express application can be imported and started
- A basic health endpoint may return a simple success response
- The React application renders a minimal application shell
- The contracts package exports a minimal placeholder schema
- API, web, and contracts tests can run
- All workspaces can build successfully

Do not add transaction domain models or transaction contracts during this
initialization task.

Avoid placeholder abstractions, generic service classes, empty repositories,
unnecessary dependency-injection containers, or speculative future modules.

## Package configuration

All package.json files must contain:

- "private": true
- clear package names
- appropriate workspace scripts
- only dependencies required by that workspace

Use workspace dependencies such as:

"@card-platform/contracts": "workspace:*"

Do not use TypeScript path aliases as a replacement for actual pnpm workspace
dependencies.

Set the root packageManager field to the exact pnpm version used.

## Completion

After initialization:

1. Install dependencies
2. Run formatting checks
3. Run linting
4. Run TypeScript type checking
5. Run tests
6. Run builds
7. Run pnpm verify

Report:

- The resulting repository tree
- The created workspace packages
- The main configuration decisions
- The validation commands executed
- Any failures or unresolved warnings

Stop after repository initialization. Do not continue implementing the
transaction module.
```

### Result

Initialized a private pnpm TypeScript monorepo with Express API, React/Vite web,
and shared Zod contracts workspaces. Added strict ESM configuration, minimal
application shells, testing tools, and repository-wide development commands
without transaction business functionality.

### Follow-up fixes

Added the Vite `/api` development proxy and fixed port 5173, expanded root lint
coverage, separated Node and browser ESLint globals, enabled React Hooks and
React Refresh linting, and split type-checking from production build configs so
tests are checked but never emitted.

### Verification

- pnpm format:check: passed
- pnpm lint: passed
- pnpm typecheck: passed
- pnpm test: passed
- pnpm build: passed
- pnpm verify: passed

## JSON-backed keyset transaction listing

### Objective and prompt

Integrate the existing transaction model, contracts, repository port, listing
use case, database-file configuration, and generic transactional JSON database.
Expose the read-only transaction-list endpoint with optional status filtering,
keyset pagination, exact `totalCount`, deterministic demo initialization, and
safe public error mapping.

### Decisions and result

- Preserved cursor pagination and added required `totalCount`; no offset, page
  number, total-page calculation, or client sorting was introduced.
- Fixed ordering is `transactionDate` descending, then `id` descending.
  Versioned opaque cursors are scoped to account ID and normalized optional
  status; page size is deliberately reusable across continuations.
- Kept filtering, exact counting, sorting, cursor validation, and pagination in
  `JsonTransactionRepository`. `JsonFileDatabase` remains generic.
- Preserved `TransactionRepository` as the replaceable boundary:
  `ListTransactions -> TransactionRepository -> JsonTransactionRepository ->
JsonFileDatabase`.
- Generated exactly 50 deterministic demo records: 45 `acc_demo` records (15
  pending, 15 posted, 15 reversed) and 5 secondary-account records.
- The default file may seed demo data when missing. Explicitly selected files
  initialize empty unless `--seed-demo` is explicitly supplied. Existing valid
  databases are never overwritten.
- Added strict persistence validation, duplicate-ID validation,
  persistence-to-domain Date mapping, centralized HTTP error mapping, and
  controlled dependency injection for Supertest.

### Red-to-green evidence

- Contract red: 5 failures because `totalCount` was unrecognized/missing;
  green: 52 focused contract tests passed.
- HTTP red: 4 endpoint tests returned 404; green: focused transaction tests
  passed after route/controller/error mapping implementation.
- Infrastructure red: cursor/database/repository modules were absent; green:
  focused cursor, demo, repository, application, and HTTP suites passed.

### Tests and limitations

Tests cover response invariants, cursor encoding/scope validation, deterministic
and safe demo initialization, real temporary JSON repository behavior,
head-insert continuation, latest counts, and Supertest coverage through the
complete Express/use-case/repository/database chain. JSON pagination is
in-memory, pages have no cross-request snapshot isolation, and unsigned cursors
are not an authorization boundary.

Final verification:

- Focused transaction contracts: 52 passed.
- Focused transaction application/infrastructure/HTTP: 31 passed.
- `pnpm format`: passed.
- `pnpm format:check`: passed.
- `pnpm lint`: passed after removing one unused middleware-argument warning.
- `pnpm typecheck`: passed.
- `pnpm test`: passed (contracts 90, API 95, Web 1).
- `pnpm build`: passed.
- `pnpm verify`: passed.
- Live default database/API verification: 50 database records; `acc_demo`
  pages 20/20/5 with total 45; each status total 15; page size 5 returned 45
  unique IDs; invalid status, size, token, and token scope returned 400.
- Live explicit-file verification: selected file contained zero records and was
  not demo-seeded; explicit `--seed-demo` produced 50 records.

## Transaction listing audit repairs

### Findings and decisions

The audit found an HTTP-to-infrastructure error import, optional broken
`createApp` composition, false-positive pagination assertions, inconsistent
transaction-ID limits, duplicated public error-code values, insufficient
bootstrap coverage, a generated runtime database acting as source data,
calendar-derived demo timestamps, and no structured operational logging.

- Moved page-token errors into Application so HTTP and Infrastructure both
  depend inward.
- Made `listTransactions` and `logger` required `createApp` dependencies and
  removed the broken default app export.
- Replaced negated `arrayContaining` checks with explicit forbidden-ID set
  intersections.
- Standardized transaction IDs at 1–64 characters with no surrounding
  whitespace; readable demo IDs remain valid.
- Exported one `API_ERROR_CODES` registry from contracts.
- Made the deterministic generator the demo source of truth; runtime JSON files
  are ignored and seed policy is exercised through real bootstrap tests.
- Replaced demo calendar timestamps with a May 2026 fixed base and fixed-seed
  Mulberry32 positive intervals no longer than 24 hours.
- Added an application-neutral Logger abstraction, exact Pino adapter, safe
  HTTP 500 logging, and structured JSON-database logging without sensitive
  records or paths.

### Red-to-green evidence

- Shared-code and ID repair red: missing registry/domain invariant/application
  errors plus DTO/persistence acceptance of invalid IDs; green: 43 contract
  tests and 23 focused domain/record/cursor tests passed.
- Runtime/logging repair red: missing Logger/Pino modules, bootstrap suite
  unable to load, July/duplicate demo timestamps, and no database error log;
  green: 48 focused API tests passed.
- Full API suite after repair: 121 tests passed.

Final verification:

- Focused contract repair suite: 43 passed.
- Focused API repair suite: 48 passed.
- Full `pnpm test`: Contracts 96, API 121, Web 1.
- `pnpm format`: passed.
- `pnpm format:check`: passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `pnpm verify`: passed.

## Remaining transaction hardening repairs

### Findings and decisions

The follow-up audit found that generated reversed transactions recorded their
last update before their reversal, Account ID validation differed across
transport and persistence boundaries, oversized cursors reached base64
decoding, startup failures were not handled at the executable boundary,
camelCase token fields were not covered by Pino redaction, and the README
incorrectly described log output as stdout/stderr.

- Kept status history out of the listing vertical slice. The current model
  continues to expose only current status and lifecycle timestamps.
- Preserved the timestamp meanings: `createdAt` is record creation,
  `updatedAt` is the last record change, and `reversedAt` is the reversal time.
  Generated reversed records now set `updatedAt` equal to their deterministic
  `reversedAt`; pending and posted generation is unchanged.
- Aligned Account IDs to 1–128 characters with no surrounding whitespace in
  contracts, Domain validation, persistence records, and cursors.
- Added a codec-local 1–2048-character base64url guard before cursor decoding.
- Moved root Pino construction to `server.ts`, injected that logger into
  bootstrap, and added a small executable-boundary helper for safe bootstrap
  and listener failure logging plus `process.exitCode = 1`.
- Added camelCase page, access, and refresh token redaction, including the
  supported request query/body nesting paths.
- Corrected logging documentation to structured JSON on stdout; collection and
  persistence remain deployment responsibilities and no local log files are
  created.

### Tests and Red-to-Green evidence

Added or expanded focused tests for Demo lifecycle timestamps, Account ID
contract/Domain/record/cursor boundaries, pre-decode cursor length protection,
maximum-length persisted Account ID retrieval through HTTP, bootstrap
process-exit isolation, executable bootstrap/listener logging, and Pino
camelCase page-token redaction.

- Contract red: 3 DTO Account ID assertions failed while the path boundary
  already passed; green: 97 focused contract tests passed.
- API red: 16 focused assertions failed and the server-boundary suite could not
  load. Failures covered the missing Domain validator, permissive record and
  cursor Account IDs, reversed timestamp mismatch, oversized token decoding,
  missing startup helper, and visible camelCase page tokens.
- API green: 57 focused repair tests passed. Repository, HTTP, full
  Express-to-JSON integration, and startup tests then passed 21/21.
- A post-implementation typecheck exposed the Node `process.exitCode` nullable
  type; the helper was aligned with Node's type and both affected workspace
  typechecks then passed.

Final verification:

- `pnpm format`: passed.
- `pnpm format:check`: passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed (Contracts 108, API 148, Web 1).
- `pnpm build`: passed.
- `pnpm verify`: passed.

Intentionally deferred: status-history auditing and any future append-only
status-event model, richer HTTP 500 diagnostics, and temporary-file cleanup
warning logs. No status-history fields, storage cleanup behavior, or public
response shapes were added.

## Create and reverse transaction backend vertical slices

### Complete prompt record

Implement the missing Create Transaction and Reverse Transaction backend
vertical slices without creating a commit. Preserve the existing list endpoint,
keyset pagination, JSON database, logging boundaries, dependency direction, and
repository architecture. Do not add editing, deletion, status history, event
sourcing, audit collections, authentication, payment authorization, settlement
batches, refunds, chargebacks, external databases or queues, per-transaction
timers, frontend UI, or a generic status endpoint.

Add `POST /api/v1/accounts/:accountId/transactions` with a required,
strictly validated `Idempotency-Key` and a strict purchase body containing only
`merchantName` and a positive safe-integer CAD amount. Generate a UUID and all
lifecycle fields on the server from injected runtime services, capture the
clock once, create the transaction as pending, retry UUID collisions a small
bounded number of times inside the atomic command, and return `201`, a
contract-shaped transaction, and a `Location` header.

Add one replaceable `node-cron` infrastructure scheduler using
`*/5 * * * * *`. Its application use case must atomically post every pending
transaction whose creation time is at least five seconds old, using one
scheduler execution time. Run catch-up reconciliation at startup, prevent
overlapping in-process executions, retain database locking for cross-process
serialization, stop the scheduler during graceful shutdown, avoid sleeps and
per-record timers, and safely log scheduler lifecycle events without transaction
or credential data.

Add
`POST /api/v1/accounts/:accountId/transactions/:transactionId/reversal` with a
required idempotency key and no body or a strict empty object. Only posted
transactions may transition to reversed. Allow reversal exactly through the UTC
instant `transactionDate + 31 * 24 * 60 * 60 * 1000`, reject it one millisecond
later, and capture reversal time once for equal `updatedAt` and `reversedAt`.
Use typed errors and stable public codes for not found, not posted, already
reversed, expired reversal window, and idempotency conflict. Expected 400, 404,
and 409 responses must not be logged as unexpected failures.

Extend every public transaction projection with non-persisted `canReverse` and
`reverseExpiresAt`. Derive both from the shared Domain reversal policy:
pending and reversed records are not reversible; posted records are reversible
through the exact deadline. Document that a future frontend must combine the
server snapshot with a successfully parsed deadline and its local clock, fail
closed, localize the deadline for display, and disable reversal after expiry
without waiting for a reload. The backend remains authoritative.

Persist idempotency for both commands in the JSON database, using a SHA-256 hash
of the key and a deterministic fingerprint of normalized semantic input rather
than storing the raw key. Store enough safe response information to replay the
original status and body after restarts. Treat keys as globally unique across
both operations, retain records indefinitely for this assignment, return the
original result for an identical replay, and return an idempotency conflict
without mutation for different input. Perform each idempotency check, business
read/validation/write, and idempotency-record write in one existing
`JsonFileDatabase` transaction and lock. Keep the generic database unaware of
transactions, status, scheduling, and idempotency semantics.

Add strict exported Zod contracts, required runtime composition dependencies,
transaction-specific atomic repository capabilities, injected Clock/UUID/hash
services, HTTP handlers, scheduler/runtime lifecycle wiring, Pino redaction for
idempotency-key fields, focused Domain/Application/Infrastructure/HTTP tests,
README documentation, and this AI-development record. Use exact `node-cron`
dependency versioning, no real-time sleeps, no raw idempotency-key logging, no
persisted eligibility fields, and no transaction writes outside an atomic
database transaction. Run focused tests throughout, then `pnpm format`,
`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
and `pnpm verify`; inspect all diffs and artifacts and recommend, but do not
create, a Conventional Commit.

### Architecture and behavior decisions

- New purchases begin pending because posting is a simulated asynchronous
  lifecycle step rather than client-controlled state. One recurring
  reconciliation job was chosen over per-transaction timers so persisted work
  survives restarts and the number of runtime timers does not grow with data.
- A five-second eligibility age plus a five-second recurring tick gives the
  requested approximately 5–10-second customer-visible pending interval.
  Startup catch-up processes records left pending while the service was down.
- Scheduling remains at the infrastructure/executable boundary.
  `PostPendingTransactions` is an independently testable Application use case,
  while named Domain policies own pending-to-posted and posted-to-reversed
  transitions.
- The reversal rule is one exact rolling duration of 31 times 24 hours from
  `transactionDate`. The same Domain policy calculates the deadline, command
  eligibility, and response projection.
- `canReverse` is intentionally a server-time snapshot. `reverseExpiresAt` is
  also exposed so a future frontend can fail closed as its local clock advances,
  while the backend revalidates every command.
- Persistent idempotency uses a global SHA-256 key identity plus a deterministic
  SHA-256 command fingerprint. The stored original transaction snapshot and
  HTTP status allow identical replay after reopen without repeating a mutation.
  Eligibility-only response fields remain projections rather than storage.
- Transaction commands use a synchronous transaction-specific session inside
  one generic JSON database transaction. That keeps Application-owned command
  sequencing atomic under the existing in-process and cross-process locks
  without teaching `JsonFileDatabase` transaction semantics or leaking
  persistence records into HTTP.
- UUID generation retries at most three collisions. Repeated collision is an
  internal failure and never overwrites a persisted transaction.
- The scheduler has an explicit in-process overlap guard in addition to the
  JSON database lock. The executable runtime owns startup reconciliation,
  scheduler start/stop, listener lifecycle, signals, and safe structured logs.

### Tests and Red-to-Green evidence

Added focused contract tests for strict create input, positive safe-integer CAD
amounts, rejected lifecycle fields, eligibility DTO fields, write paths,
idempotency keys, and new public error codes. Added Domain and Application tests
for allowed transitions, exact posting and reversal boundaries, projections,
single-capture timestamps, UUID collision handling, global idempotency replay
and conflict, and deterministic posting. Added real temporary-file integration
tests for atomic command persistence, concurrency, reopen replay, malformed
idempotency storage, and scheduler/reversal serialization. Added HTTP tests for
all write success/error/replay paths and safe logging, plus scheduler,
executable lifecycle, bootstrap catch-up, and Pino-redaction tests.

Observed Red-to-Green results:

- Contract red: the new write-contract suite could not load because its modules
  did not exist, and five new error-code assertions failed. Green: the focused
  contract run passed 129 tests; the final contract suite passed 130.
- Domain/Application red: the policy and command suites could not load because
  the required modules did not exist. Green: all focused policy and application
  tests passed.
- Persistence red: the command integration suite could not load because the
  atomic command adapter did not exist. Green: the focused command, repository,
  and demo integration tests passed.
- HTTP red: the presenter module was missing and all 12 initial POST assertions
  returned 404. Green: the initial focused HTTP/presenter run passed 17 tests;
  the expanded Application/HTTP/Infrastructure run passed 29.
- Scheduler red: the scheduler module was missing and the server lifecycle test
  observed no reconciliation/start/stop activity. Green: all 5 focused
  scheduler/runtime tests passed.
- Logging red: direct and request-nested idempotency keys appeared in Pino test
  output. Green: the focused adapter redaction test passed with both values
  redacted.

Two full-sequence findings were corrected rather than hidden:

- The first `pnpm lint` run found an unused test binding; the test was corrected
  and lint passed.
- A subsequent `pnpm typecheck` run exposed insufficient narrowing after the
  operation-specific idempotency snapshot schema was strengthened; the adapter
  now checks the expected stored status before returning the snapshot.

### Final verification and deferred production concerns

Final required command results:

- `pnpm format`: passed.
- `pnpm format:check`: passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed (Contracts 130, API 196, Web 1).
- `pnpm build`: passed.
- `pnpm verify`: passed with the same workspace test totals.

Intentionally deferred production concerns include authentication and
authorization, real payment authorization and settlement, a durable queue or
separate worker, scheduler leadership beyond JSON-file locking, idempotency
retention and cleanup policy, cryptographically signed page tokens, richer
audit/status-event history, refunds and chargebacks, and frontend transaction
creation/reversal behavior. The recurring scheduler demonstrates assignment
reconciliation behavior; it is not a payment-network or settlement processor.

## Transaction API and Domain model completion

### Complete implementation prompt

Treat the complete current source tree, staged changes, unstaged changes, and
untracked files as the source of truth. Do not create a commit. Read the
repository and workspace instructions plus architecture, dependency, and
testing guidance; inspect the complete Transaction Domain, Application,
repository, HTTP, scheduler, runtime, contract, test, and documentation surface;
then plan and use focused Red-to-Green development without fabricating results.

Make the transaction state machine explicit and framework-independent:
`pending -> posted`, `posted -> reversed`, and terminal `reversed`. Provide a
readonly allowed-transition table, structural query/assertion functions, and a
typed internal Domain error. Route the named posting and reversal behaviors
through that state machine while preserving the five-second posting guard,
exact rolling 31-day reversal guard, and the existing specific public business
errors. Do not expose a generic status PATCH, client-selected transition,
status history, event sourcing, or audit-event persistence.

Add
`GET /api/v1/accounts/:accountId/transactions/:transactionId` with strict
Account ID and Transaction ID path contracts, a `{ data: TransactionDto }`
response, current-clock eligibility projection through the existing presenter,
account-isolated not-found semantics, safe error mapping, an Application
`GetTransaction` use case, an extended read-side repository port, and a real
JSON adapter. Make `GetTransaction` a required `createApp` dependency and keep
the HTTP-to-Application-to-read-repository dependency flow. Preserve Create's
URL-encoded `Location` and prove that both initial and replayed locations resolve
to the same pending resource.

Define write idempotency as successful-command-only. Validation failures,
business rejections, and unexpected persistence failures must not consume the
key. Successful mutation and idempotency insertion remain one atomic JSON
database transaction. A pending reversal rejected with key K may be retried
with K after posting, at which point success stores K and later identical
requests replay that successful reversal. Successful conflicting reuse remains
`IDEMPOTENCY_CONFLICT`, and a different key after reversal remains
`TRANSACTION_ALREADY_REVERSED`. Do not store failure responses or describe the
behavior as replaying the first outcome of every request.

Log Application command-boundary business rejections once at non-error level
with safe stable fields: component, event, command, and rejection reason.
Cover not found, not posted, already reversed, expired reversal window, and
idempotency conflict. Never log account or transaction IDs, merchant data,
amounts, raw keys, hashes, fingerprints, request bodies, transactions, or
database paths. Successful commands/replays are not rejection logs, expected
HTTP failures remain outside unexpected 500 logging, and unexpected failures
retain safe error-level diagnostics.

Document the actual multi-process scheduler model without implementing
leadership: every API process may own a scheduler, reconciliation is
state-based and repeatable, selection and update are one atomic database
transaction, each process skips local overlap, and the shared physical-file lock
serializes cross-process mutation. Later processes normally reread posted state
and no-op. Do not claim exactly-once execution or a singleton cron. Explain that
production replicas would normally use a dedicated worker, distributed job
ownership, or durable queue, and that container-local JSON files are not shared
storage.

Add strict contracts, repository methods, required composition, focused
contract/Domain/Application/Infrastructure/HTTP/logging tests, a real
temporary-database integration test, README documentation, and this development
record. Preserve pagination, total counts, cursor scoping, scheduler catch-up,
no-overlap, atomic JSON replacement, locking, Pino redaction, startup behavior,
and all existing tests. Use no real sleeps. Run formatting, lint, typecheck,
tests, build, verify, final diff/artifact searches, and report results and a
recommended Conventional Commit without committing.

### Decisions and implementation

- The Domain exports a precisely typed readonly transition table plus
  `canTransitionTransactionStatus` and
  `assertTransactionStatusTransition`. The named posting and reversal functions
  keep their specific guards and errors, then assert their structurally allowed
  transition before returning the new discriminated transaction state.
- `GetTransaction` depends on the existing read-side
  `TransactionRepository.findByAccountAndId`. The JSON adapter filters account
  and ID together before mapping the record, so absence and account mismatch
  have the same Application error and public 404.
- The single-resource HTTP handler reuses the shared Transaction DTO and
  existing presenter. Eligibility is projected using one injected-clock value;
  no response-only field is persisted.
- Create continues to build an encoded resource Location from validated path
  input and server-generated ID. The new GET route makes that Location
  dereferenceable; successful replay returns the same ID, Location, and body.
- Successful-command-only idempotency required no change to the command
  transaction sequence: all rejection paths throw before `saveCommand`, and
  the generic JSON transaction commits neither its working mutation nor its
  idempotency insertion when the callback or replacement fails. New tests make
  this contract explicit.
- A focused `LoggedTransactionCommand` Application decorator wraps only Create
  and Reverse executors at app composition. It maps typed expected failures to
  one safe info event and rethrows for the existing centralized HTTP mapping.
  Reads and invalid transport input are not command-rejection logs, and
  unexpected failures are left for the safe HTTP 500 logger.
- Scheduler runtime behavior was deliberately unchanged. Documentation now
  distinguishes repeatable lock-serialized reconciliation from singleton,
  exactly-once, or distributed scheduling guarantees.

### Tests and observed Red-to-Green results

- Contract red: the focused single-GET suite could not load because
  `get-transaction.ts` did not exist. Domain red: 9 state-machine assertions
  failed while all 7 existing transition-specific assertions remained green.
  After the minimum contract and Domain implementation, the focused suites
  passed 15/15 and 16/16.
- Application/HTTP/Infrastructure red: the read use-case and full integration
  suites could not load the missing `GetTransaction`; all 10 single-GET HTTP
  assertions received the dangling Express 404; the repository read test failed
  because `findByAccountAndId` was absent; and 5 command-rejection cases emitted
  no log. The focused green run passed 56/56 across six suites.
- The newly added successful-command-only persistence tests passed on their
  first baseline run (9/9), confirming that current thrown rejections already
  aborted without storing keys. They were retained and expanded rather than
  altered to manufacture a red result.
- Expanded tests cover pending rejection followed by same-key success and
  replay, not-found and expired non-consumption, HTTP validation
  non-consumption, atomic replacement failure rollback, stable successful
  replay, same Location resolution, account-isolated GET, encoded Location,
  safe rejection fields, no sensitive identifiers, and no rejection log for
  success or replay.
- After implementation, the expanded command, HTTP, and full integration
  focused run passed 40/40. Production bootstrap and full API-to-JSON Location
  assertions passed 20/20.
- API typecheck found one missing `Transaction` type import in the new HTTP
  executor interface; adding the import made both affected workspace typechecks
  pass.
- The first full command sequence reached formatting, then lint reported two
  unused test bindings. The tests were rewritten without weakening their
  assertions. The subsequent full sequence passed.

### Verification and limitations

Verification after the implementation and documentation changes:

- `pnpm format`: passed.
- `pnpm format:check`: passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed (Contracts 145, API 226, Web 1).
- `pnpm build`: passed.
- `pnpm verify`: passed with the same workspace totals.

Known limitations remain deliberate: no distributed scheduler ownership,
dedicated worker, durable queue, cross-filesystem coordination, failure-result
idempotency records, idempotency cleanup, generic status API, status history,
audit-event persistence, deletion, authentication, payment-network behavior, or
frontend UI. The shared-file correctness model applies only to processes using
the same physical JSON file.

## Customer-facing Transaction frontend vertical slice

### Complete implementation prompt record

Implement the complete current Transaction frontend vertical slice using the
complete source tree—including staged, unstaged, and untracked files—as the
authority. Read all repository/workspace instructions, architecture,
dependency, testing, contracts, backend endpoints/error codes, frontend and
browser tooling, README, PROMPTS, and working-tree state before planning or
editing. Do not change backend behavior or shared contracts without a
demonstrated frontend-blocking defect, do not create a commit, and use honest
focused Red-to-Green development before complete verification.

Replace the shell with a polished responsive financial Transaction History:
server-side All/Pending/Posted/Reversed filtering synchronized to URL search
parameters, total counts, accessible single-DOM list rows, opaque keyset Load
more, local CAD/date formatting, loading/empty/error/retry states, and a
route-driven account ID. Add strict Create, nested route-driven Detail,
Pending-to-Posted polling, fail-closed dynamic reversal eligibility, and
confirmed Reverse flows. Create and Reverse must generate in-memory frontend
Idempotency-Key values, reuse them only for uncertain outcomes, prevent
duplicates, and never log/store/expose keys or financial payloads.

Use the shared Zod contracts and public error registry as the DTO/runtime
authority. Implement a thin native Fetch transport supporting GET/POST, JSON,
headers, status, AbortSignal, successful schema validation, public error
parsing, safe typed HTTP/network/contract/cancellation errors, malformed or
empty payloads, 5xx, and no global UI side effects. Encode every path segment
and preserve cursors opaquely.

Use one React root and one context-based typed `OverlayProvider` with a
discriminated programmatic union for Create and reversal confirmation plus
controlled registration for route Detail. Keep one logical stack, centralized
depth/z-index, topmost-only dismissal, and no global singleton, second root,
event bus, keydown listener, manual focus trap, or legacy Modal compatibility.
Use only Radix Dialog and AlertDialog. Responsive overlays must retain one
content DOM and morph through CSS below 40rem into a safe-area-aware Bottom
Sheet and at/above 40rem into a centered Modal. No user-agent checks, gestures,
dragging, swipe behavior, sound, or JavaScript unmount timers.

Centralize semantic color, system light/dark theme, z-index, radius, and motion
tokens. Plain CSS owns Tailwind's entry, global reset, tokens, and theme;
Tailwind owns straightforward layout/spacing/typography; SCSS Modules own
complex local state, glass surfaces, pseudo-elements, Radix animations, and
the responsive overlay morph. Use concise locally scoped class names, readable
solid no-blur fallbacks, reduced motion, visible focus, touch-sized controls,
textual statuses, and Neo-inspired but non-copying visual direction.

Parse CAD text exactly into positive safe integer minor units, accepting one
period or comma separator with at most two fractional digits and rejecting
zero, negatives, exponent notation, ambiguity, excess precision, and unsafe
results. Detail must fetch the single-resource endpoint, keep History mounted,
handle loading/not-found/retry/invalid-contract states, display all public
timestamps and eligibility, and explicitly close to the parent route. History
and Detail reconcile through feature-local Outlet context, preserving immutable
sort position, filter membership, counts, and ID deduplication.

Only an open Pending Detail may poll. Use recursive two-second timeouts,
non-overlapping requests, cleanup abort, visibility pause/resume, contained
failure feedback, and terminal-status shutdown; use fake timers rather than
real delays in tests. Reverse eligibility is `canReverse AND parsed deadline
AND local clock <= deadline`, with one-second local clock updates while useful.
Reverse must use a nested destructive AlertDialog, keep Detail underneath,
remain open while submitting, disable all dismissal and duplicates, close only
after known success, never update optimistically, reconcile returned
timestamps, and deliberately handle every stable public business error.

Add focused unit, Fetch/API, MSW integration, overlay/accessibility,
responsive, polling, idempotency, and deterministic Playwright coverage for
desktop lifecycle, mobile nested overlays, direct Detail, and keyboard focus.
Update `apps/web/AGENTS.md`, focused frontend architecture documentation,
README setup/behavior/limitations/AI usage, and this record. Run formatting,
lint, typecheck, all tests, builds, `pnpm verify`, Playwright, complete
working-tree/diff/package/lock inspection, and prohibited-pattern searches.
Report actual results, limitations, and one recommended Conventional Commit
without committing.

### Implementation plan and architecture decisions

The pre-edit plan was:

1. Establish exact money/formatting, fail-closed eligibility, list
   reconciliation, idempotency-attempt state, typed Fetch, and Transaction API
   boundaries.
2. Compose the one-root router/provider tree, unified Radix overlay stack,
   shared accessible UI, and centralized token/theme/style pipeline.
3. Implement History/Detail routing plus programmatic Create/Reverse,
   cancellation/stale-response control, recursive polling, and dynamic
   eligibility.
4. Add focused MSW/unit/overlay tests and deterministic Playwright journeys.
5. Update durable documentation, run complete verification, and audit the
   whole current tree.

The legacy Modal approach was replaced rather than wrapped. `BrowserRouter`,
one `OverlayProvider`, and one programmatic host remain under the existing
single React root. Detail registers as a controlled stack member; typed Create
and reversal entries share depth and topmost state. Radix owns focus,
background inertness, accessible Dialog/AlertDialog semantics, and Escape.
Application code owns route close behavior, stack ordering, write-time
dismissibility, and CSS presentation.

History owns the filter-scoped list and exposes one reconciliation callback
through Outlet context. Create closes, reconciles Pending, and navigates to
Detail. Detail fetch/poll/reverse responses reconcile back into History.
Reconciliation is ID-deduplicated, ordered by immutable transaction date/ID,
and adjusts filtered membership/counts.

The responsive overlay is one DOM across viewports, with no gestures.
Centralized CSS custom properties own z-index calculations and motion timing.
System preferences drive themes. Plain CSS/Tailwind/SCSS responsibilities and
concise CSS Module naming are enforced in the Web instructions.

Create and Reverse use the same pure in-memory attempt lifecycle. A semantic
intent receives one UUID key; uncertain network/5xx results retain it,
successful/explicit rejections clear it, and changed Create values start a new
intent. The short backend posting transition and two-second polling remain
explicit take-home demonstrations, not payment-network timing or a production
notification recommendation.

### Tests and observed Red-to-Green results

- The first four model suites failed to resolve the absent formatting,
  eligibility, reconciliation, and idempotency modules. The focused green run
  passed 29 tests.
- The first shared Fetch/Transaction adapter run failed to resolve both absent
  modules. The focused green run passed 10 tests covering safe responses and
  errors, path encoding, cursor preservation, strict bodies, and write
  headers.
- The first App integration run failed all four tests against the old shell:
  History, direct Detail, Create, and nested reversal were absent. After the
  initial implementation, Create validation was the first green branch; after
  resolving a jsdom/native AbortSignal realm incompatibility at the Fetch
  boundary, all four passed. The suite was then expanded to eight green MSW
  scenarios for filtering/pagination, exact Create, uncertain same-key retry,
  routing, nesting, and successful reversal.
- Three recursive polling tests using fake timers and controlled promises were
  added after the hook existed; they passed on their first run and prove
  terminal shutdown, no overlap, visibility pause/resume, and unmount abort.
  They are not presented as fabricated Red evidence.
- The first browser run passed mobile and direct-route tests and failed desktop
  Pending visibility plus route-unmount focus restoration. The deterministic
  mock now models Strict Mode duplicate reads, and route state explicitly
  restores focus to the History trigger. The next Playwright run passed all
  four desktop/mobile/direct/keyboard workflows.
- The first combined formatting/lint sequence found a synchronous Detail state
  update inside an effect, a mutable interval declaration, and one Fast Refresh
  warning. The effect/reset and style exports were corrected; lint then passed
  without warnings.

### Verification and deferred concerns

The final `pnpm verify` passed formatting, lint, typecheck, all workspace tests,
and all builds. Test totals were Contracts 145, API 226, and Web 50. The
production Web build transformed 219 modules and emitted a 373.30 kB JavaScript
bundle (116.26 kB gzip). The final Playwright run passed all four Chromium
workflows in 4.0 seconds.

Deliberately deferred concerns remain authentication/authorization, account
selection, real payment processing, production event delivery, analytics,
manual theme selection, persistent client caches, distributed scheduling, and
database-backed reads. JSON persistence, approximately 5–10-second demo
posting, and two-second open-Detail polling are constrained demonstration
mechanisms. Browser coverage uses deterministic interception; backend protocol
and persistence remain covered by the existing API/contract suites.

## Prior Transaction correctness, date-range, shared controls, and localization

### Complete repair-and-extension prompt record

Repair and extend the complete current Transaction application using staged,
unstaged, and untracked source as the authority, without committing. Preserve
the approved vertical-slice architecture while correcting uncertain-write
idempotency, History query preservation, Detail resource identity, overlay
ownership/closing/dismissal/focus, and provenance-specific list
reconciliation. Add a paired UTC `from`/`to` list contract with inclusive start,
exclusive end, count-before-page semantics, and cursor scope validation.

Add an accessible reusable React Aria date-range picker inside the existing
overlay system. History must keep local `CalendarDate` values in
`fromDate`/`toDate`, derive a loaded-row oldest/newest suggestion or a
three-calendar-month fallback, separate draft from applied state, issue no
request while editing, and issue exactly one first-page request on Apply after
DST-safe local-midnight conversion. Add English/French i18next browser
detection, saved-choice precedence, regional normalization, English fallback,
`en-CA`/`fr-CA` display formatting, complete resources, and a Radix Select
language control before the account label.

Create reusable shared Input, CurrencyInput, and Select controls. Currency
drafts must remain text, accept editable decimal intermediate states, and
reject alphabetic/financially unsafe input. Preserve Merchant Name's strict
trimmed 1–120-character contract. Keep desktop amount right edges aligned and
give the single shared mobile row DOM a clear merchant/date, amount, status,
action hierarchy. Update durable instructions and documentation, record honest
Red-to-Green evidence, run all required checks plus desktop/mobile Playwright,
audit prohibited patterns and repository state, recommend one Conventional
Commit, and do not create it.

### Correctness findings and decisions

- Successful responses that fail runtime schema validation are uncertain write
  outcomes. `ResponseContractError` now retains the original in-memory
  Idempotency-Key for both Create and Reverse retries.
- Detail links append the complete History search string. The route element is
  keyed by encoded account/transaction identity, aborts obsolete reads, and
  cannot render a late response from the prior identity.
- Programmatic entries may declare `ownerId`. Closing marks a parent and every
  descendant as closing; removal and controlled-owner unregistration
  recursively remove descendants. This prevents a reversal confirmation from
  surviving route-owned Detail teardown.
- Radix remains the dismissal/focus owner. AlertDialog has one explicit
  backdrop pointer path; Dialog uses Radix outside interaction. Closing entries
  stay mounted for CSS `data-state="closed"` animation and are removed by its
  animation event, with a no-animation environment fallback and no JavaScript
  duration constant.
- List mutations are provenance-specific. Single-resource reads only update a
  loaded ID, confirmed Create may prepend/increment when it matches the active
  filter, and status transitions add/update/remove according to prior and next
  membership. Unloaded Detail reads never increment `totalCount`.
- The public date contract accepts both UTC instants or neither and requires
  `from < to`. Repository filtering is `transactionDate >= from &&
transactionDate < to`; exact count follows account/status/date filtering and
  precedes cursor/page slicing. Cursor payloads bind normalized account,
  status, `from`, and `to`.
- The earlier picker initialization and action model was superseded by the
  explicit, unbounded-default Search by Date decision recorded below. Absolute
  bounds remain 1970-01-01 through local today.
- Draft dates live inside the overlay. Cancel changes neither URL nor network
  state; explicit Search writes both calendar-date parameters and triggers one
  replacement first-page query. The inclusive end becomes next-day local
  midnight before UTC conversion, avoiding end-of-day arithmetic and handling
  DST.
- React Aria Components owns date-field/calendar accessibility. Radix Select
  owns the one shared Select implementation and portals on the centralized
  popover layer.
- i18next with the browser detector checks saved preference before navigator
  language, normalizes English/French regional tags, falls back to English, and
  persists only the normalized language. Symmetric local resources cover every
  customer-visible string; API enums remain unchanged. The selected language
  controls CAD, date/time, calendar, and count formatting through `en-CA` or
  `fr-CA`.
- Shared Input owns native input semantics and error/hint wiring. CurrencyInput
  composes it with `inputMode="decimal"` and rejects invalid controlled drafts
  before state changes. The localized placeholder is supplied by the feature.
  Desktop rows use a stable grid and fixed right-aligned amount column; mobile
  reflows the same DOM into its visual hierarchy.

### Tests and observed Red-to-Green results

- The first focused contract run had one failure because `from`/`to` were
  rejected as unknown. The first focused API run had four failures: the
  application dropped the range, changing range did not invalidate a cursor,
  valid HTTP dates returned 400, and repository count ignored dates. After the
  contract/application/repository/cursor/HTTP implementation, the contract
  suite passed 67/67, focused API suites passed 37/37, and the expanded
  end-to-end API integration suite passed 16/16.
- Frontend tests first produced eight intended failures: response-contract
  failures were not uncertain, provenance list operations were absent,
  malformed Create success changed its key, and Detail navigation dropped
  History search. The corrected focused API/list/App runs passed.
- Localization/date/form-control tests initially could not resolve the new
  modules, and the pre-existing CurrencyInput accepted invalid alphabetic
  state. The completed focused group passed 43/43. A CalendarDate maximum test
  was corrected after confirming the library deliberately clamps its supported
  year range; product bounds remain independently validated.
- The expanded App suite passes 16/16, including malformed Create/Reverse
  same-key retries, date draft/Cancel/Apply request behavior, French persistence
  and formatting, complete query survival, stale Detail response isolation,
  and route-owner descendant cleanup.
- Controlled overlay tests pass 2/2 and prove that a closing overlay waits for a
  manually dispatched animation event and that one backdrop pointer action
  produces one close request. The existing fake-timer polling and exact
  deadline suites remain green.
- The first complete typecheck found two test fixtures whose conditional
  `status`/`reversedAt` values did not preserve the domain discriminated union;
  explicit discriminated spreads fixed both without weakening assertions. The
  first lint run reported a date-range object dependency and a Fast Refresh
  helper export; primitive range dependencies and a separate pure helper module
  resolved both, leaving lint with no warnings.

### Verification and remaining limitation

Before the final `pnpm verify`, the explicit required commands passed:
`pnpm format`, `pnpm format:check`, `pnpm lint` with no warnings,
`pnpm typecheck`, `pnpm test` (Contracts 155, API 234, Web 100), and
`pnpm build`. The production Web build transformed 1,539 modules and emitted a
724.54 kB JavaScript chunk (231.69 kB gzip); Vite reported its non-failing
greater-than-500-kB chunk-size warning. Playwright passed all five Chromium
desktop, mobile, direct-route, keyboard-focus, and date/localization workflows
in 6.4 seconds.

The subsequent `pnpm verify` also passed formatting, zero-warning lint,
typecheck, the same 489 workspace tests, and all builds. It repeated the same
non-failing client chunk-size warning.

The larger client chunk is the remaining implementation warning and a sensible
future code-splitting target. Authentication/authorization, production data
storage, real posting/event delivery, and distributed scheduling remain
outside this assignment's scope.

## Search by Date redesign and Transaction frontend correctness

### Complete implementation prompt

Implement the approved Search by Date redesign against the complete current
source tree, including staged and untracked files, without creating a commit.
Read all repository and workspace instructions, frontend architecture,
dependency, accessibility, and testing documentation; inspect the current
History, URL/API date behavior, shared picker, React Aria, overlay stack,
reconciliation, status filtering, localization, pagination, all relevant
tests, README, PROMPTS, and every worktree state before planning or editing.
Use honest test-driven development for observable behavior and retain the
backend's optional paired UTC instants, inclusive `from`, exclusive `to`,
date-scoped cursor, and post-filter `totalCount`.

The required product model is date-unbounded History by default. Search by Date
opens with an empty Start/End and today's localized month unless a range is
already applied. Draft field edits, date-cell selection, adjacent-month
selection, and month navigation remain local: they must not change URL, rows,
cursor, count, background History, or network state. Only enabled, guarded
Search may validate and write inclusive local `fromDate`/`toDate`, preserve
status, discard pages/cursor, close, and issue one first-page request. Cancel,
close, Escape, and backdrop discard the draft. An identical applied range
should avoid a practical refetch.

An applied localized range replaces the inactive control and remains editable;
a separate close-icon button clears it with an accessible name containing the
range. Clear removes only the date parameters, preserves status, aborts or
invalidates the range request, discards range rows/cursor, requests one
unbounded first page, restores a stable toolbar focus target, and returns the
inactive control. Status and date are independent query dimensions, each reset
pagination when changed, and date controls must sit outside the status-labelled
ARIA group.

Client reconciliation must use one deterministic complete-query predicate over
status and optional local date range, with invalid transaction dates failing
safely and boundaries matching the UTC API conversion. Confirmed Create,
Detail/polling transitions, and Reverse updates use it so membership and
`totalCount` change exactly once, outside-range transactions never appear, and
IDs remain deduplicated. Shared DateRangePicker code must not import Transaction
feature code; generic range types and validation belong in shared date
primitives or public library types.

Every displayed month must contain exactly 42 real cells across six
locale-derived weeks. Preceding/following-month dates are visible, muted when
unselected, readable in both themes, keyboard reachable, selectable within
min/max, and disabled outside bounds. Selecting one updates the draft and month
context without a request. Range styling must be continuous: strong rounded
start/end points, a lighter connected middle, a clear single-day state,
cross-month selection styling, and visible hover/focus, driven by React Aria
state attributes and semantic tokens.

Applied URL dates stay `YYYY-MM-DD`. Requests convert local Start midnight and
the midnight after inclusive End to UTC ISO without end-of-day, fixed-day,
offset, locale-string, or fixed-90-day arithmetic. Bounds remain 1970-01-01
through local today. Empty states must distinguish no query, status only, date
only, and combined status/date, remain localized in English/French, and never
offer a first-transaction explanation merely because a search is empty.

AlertDialog Cancel must have one structural close source and call close once,
while retaining animation, focus restoration, and owner cleanup. Continue
using the local currentColor decorative Calendar icon. Add every new visible
and accessible string in English and French with `en-CA`/`fr-CA` formatting
and localized status labels.

Cover the pure URL transformations, UTC boundaries, complete-query membership,
all mutation transitions, picker empty/applied drafts, zero-request editing,
validity, cancellation, one Search emission, 42 cells across natural month
shapes, adjacent/min-max/keyboard behavior, continuous/single-day attributes,
History Search/Clear/status/cursor/request behavior, query-aware English/French
empty states, outside-range Create and transitions, overlay-stack reuse,
single Cancel close, dismissal/focus, and responsive shared DOM. Replace the
desktop, mobile, and French Playwright date workflows. Update Web instructions,
README, architecture documentation, and this record; run formatting, lint,
typecheck, all tests, builds, verification, relevant Playwright, complete git
and dependency audits, and prohibited-pattern searches. Report actual results,
limitations, and one Conventional Commit recommendation without committing.

Explicitly excluded behavior: automatic querying while selecting, loaded-row
default ranges or reset, presets, time selection, local-only result filtering,
another calendar or overlay system, drag/swipe, infinite-scroll observers, and
arbitrary status modification.

### Product and architecture decisions

- Default History is unbounded and Search by Date owns an empty-or-applied
  overlay draft. Applied state exists only in URL parameters and the active API
  query.
- The toolbar exposes an independently labelled status group and separate date
  controls. Applied edit and Clear are distinct controls with localized range
  names.
- The shared picker depends on shared `CalendarDateRange` validation and the
  existing React Aria system. `weeksInMonth={6}` supplies 42 real cells, while
  a shared cell adapter makes valid adjacent dates selectable and exposes
  semantic range attributes.
- `TransactionListQuery` combines status, local range, and timezone.
  `matchesActiveQuery` converts that range through the same DST-safe UTC
  boundary function used by HTTP requests.
- Radix AlertDialog Cancel exclusively owns its structural close; the nested
  Button no longer repeats the callback.

### Observed Red-to-Green results

- The first URL/query focused run produced 15 intended failures because the URL
  transformations, full-query predicate, and query-shaped reconciliation did
  not exist. After implementation, the two suites passed 21/21.
- The first picker run produced six intended failures: empty drafts were not
  supported, natural month grids were not fixed at 42, adjacent dates were
  disabled, and a cross-month middle cell was not selected. After the shared
  React Aria six-week/adjacent-cell implementation, the picker suite passed
  9/9.
- The superseded History tests then failed on the prior date-range language and
  action model. Updated MSW/RTL workflows passed together with URL/status
  preservation, one Search request, one Clear request, cursor invalidation,
  range controls, focus restoration, English/French empty states, and
  outside-range Create behavior.
- The broader focused implementation group passed 57/57 before the final
  History and picker additions. After correcting pointer/React Aria range
  coordination, the final picker plus History integration run passed 29/29.
- The first complete date-workflow Playwright run exposed two real test and
  interaction issues: development Strict Mode created an additional baseline
  request, and adjacent-date pointer selection lost its first anchor. The tests
  now measure requests relative to the loaded baseline, and the picker
  suppresses duplicate React Aria changes only while coordinating a manual
  pointer range. The completed workflows then passed.
- A later backdrop-draft regression exposed that relying only on Radix's
  outside-pointer path was not sufficient after an intercepted calendar cell
  press. The shared Dialog backdrop now owns one explicit close request, with a
  component regression proving a single callback and Playwright proving the
  draft is discarded.

### Final verification

The explicit required commands all passed: `pnpm format`,
`pnpm format:check`, `pnpm lint` with no warnings, `pnpm typecheck`,
`pnpm test`, and `pnpm build`. The complete test run passed 155 Contracts,
234 API, and 124 Web tests (523 total).

The subsequent final `pnpm verify` repeated and passed formatting, lint,
typecheck, all 525 workspace tests (155 Contracts, 234 API, and 126 Web), and
every build. The production Web build transformed 1,542 modules and emitted a
726.39 kB JavaScript chunk (232.81 kB gzip). Vite
reported its non-failing greater-than-500-kB chunk-size warning.

The final Playwright execution passed all seven Chromium workflows in 6.4
seconds, including the desktop Search/edit/paginate/Clear flow, mobile
six-week/adjacent-date flow, and French localization flow.

The remaining known implementation warning is the existing large client
bundle, for which route-level code splitting is a suitable follow-up.
Authentication/authorization, production persistence and event delivery remain
outside this assignment's scope.

## Search by Date deterministic calendar repair

### Prompt and objective

Repair the complete current Search by Date implementation using the full source
tree, including staged and untracked work, without creating a commit. Remove
all mutation of React Aria `RangeCalendarStateContext`, `Object.assign` state
patches, replacements of `visibleRange`, `selectDate`, `isSelected`, and
`isCellDisabled`, pointer anchor/completed-range refs, forced
`isOutsideMonth: false`, guarded field changes, pointer event bypasses, and
multi-setter selection. Replace them with a documented public primitive and one
controlled draft shared by pointer, keyboard, Start/End fields, and validation;
keep displayed month independent and navigation-button-only.

The repaired calendar must give immediate first-click feedback, normalize
reverse and same-day ranges, render 42 real dates for every month, keep valid
outside dates visible/selectable without changing the heading, distinguish
current/outside/disabled states, use circular hover and continuous range
styling, retain localized accessible interaction, and remain draft-only until
explicit Search. Use an isolated DST-safe `Date`/`CalendarDate` adapter if
needed. Initial empty search must show no error, while incomplete interaction
does. Preserve the existing URL/API, overlay, i18n, status, pagination, and
single-request semantics.

Add focused adapter, state, field, keyboard, fixed-week, adjacent-day,
modifier/style, validation, integration, StrictMode, MSW, and deterministic
desktop/mobile/French Playwright coverage. Update Web rules, frontend
architecture, customer documentation only where behavior changes, and this
record. Run format, format check, lint, typecheck, all tests, build, verify,
relevant Playwright, complete git/dependency audits, and prohibited-pattern
searches. Report actual results and limitations without committing.

### Root cause and implementation decision

The previous picker attempted to extend a React Aria range calendar beyond its
public visible-range behavior by replacing methods and values on private
context state. Independent pointer refs then competed with React Aria and the
DateFields, so the first click could be invisible and outside-day pointer and
keyboard behavior diverged.

The calendar grid now uses exactly pinned `react-day-picker` 10.0.1, while
React Aria remains responsible for the DateFields and the repository's
OverlayProvider/ResponsiveOverlay remain unchanged. One controlled
`CalendarDateDraft` is the selection source. DayPicker's controlled `month`,
`fixedWeeks`, `showOutsideDays`, range selection, public modifiers, and custom
DayButton API provide the grid behavior. The only separate state is
`displayedMonth`. A shared local-midday adapter isolates all JavaScript Date
conversion.

### Observed Red-to-Green results

- The initial adapter test failed because the adapter module did not exist; its
  DST and year-boundary round trips pass after adding the local-midday adapter.
- The first-click test failed because the previous picker emitted no change;
  the initial empty-overlay test failed because incomplete validation was shown
  immediately. After the controlled draft and interaction tracking changes,
  the focused History workflow passes and the first click updates Start while
  retaining an incomplete draft.
- The adjacent-month heading test initially exposed a duplicate-heading test
  selector in the old DOM; after using its accessible heading, the product
  assertion passed. DayPicker's controlled boundary focus then exposed that its
  default arrow behavior tried to page at an outside date. The public custom
  DayButton now moves focus among the 42 rendered, enabled dates without
  changing `displayedMonth`; the fixed-week/adapter/picker group passes 21/21.
- The full App integration run initially exposed focus being applied to the
  soon-to-be-unmounted applied-range control during Clear. A post-render effect
  now restores focus to the stable Search by date control; App passes 21/21.

### Final verification

All requested commands passed: `pnpm format`, `pnpm format:check`, `pnpm lint`
with no warnings, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm
verify`. The final full workspace run passed 155 Contracts, 234 API, and 139 Web
tests (528 total). The production build transformed 2,576 modules and emitted a
749.72 kB JavaScript chunk (237.87 kB gzip); Vite retained its
non-failing greater-than-500-kB chunk warning.

The first relevant Playwright run passed desktop, mobile, and keyboard workflows
but exposed that the French test queried weekday headings through a role the
primitive intentionally hides from the accessibility tree. The assertion now
verifies the French accessible date name. The rerun passed all four Search by
Date Chromium workflows, and the final rerun passed them in 5.6 seconds.

One post-change `pnpm verify` attempt encountered six unrelated API
filesystem-test timeouts at the common five-second limit under transient
parallel load; formatting, lint, typecheck, and Web tests passed in that
attempt. No timeout was increased and no test was weakened. An unchanged rerun
completed successfully with all 528 tests and builds passing.

The final source search found none of the prohibited state mutation, pointer
anchor, forced outside-month, debug, focused-test, or skipped-test patterns.
The only known limitation is the existing large production bundle warning;
adding DayPicker increased the built client chunk, so route/vendor splitting is
a suitable follow-up.

## Search by Date final range semantics

### Prompt and approved decisions

Repair and finalize the complete current Search by Date implementation from the
full source tree without creating a commit. Keep React DayPicker,
`@internationalized/date`, the existing URL/API contract, query composition,
pagination, localization, and Overlay stack. Replace editable Start/End fields
with read-only localized summaries and make one pure reducer own all pointer,
keyboard, same-day, reverse-order, adjacent-day, and complete-range restart
transitions. Incomplete selection must disable Search without displaying an
error.

Keep the selected draft independent from the displayed month. Render 42 real
dates, retain selectable adjacent days without month jumps, and add localized
previous/next month plus previous/next year step controls bounded by
1970-01-01 and the current local month. Preserve continuous two-layer range
styling. Format compact applied ranges with conditional years through `Intl`:
omit current-year years, show a shared historical year once, and show both
years for cross-year ranges. Only Search may request Transactions.

Remove duplicate Overlay backdrop close callbacks so Radix `onOpenChange` is
the single dismissal source, retain dismissal prevention and focus/animation
behavior, remove obsolete incomplete-range translations, and remove unused
React Aria direct dependencies and lockfile entries. Update durable Web rules,
frontend architecture, customer documentation, component/integration/browser
tests, and report only verification actually run.

### Implementation and observed Red-to-Green results

The range-reducer and conditional-year formatter tests first failed because
their exports did not exist. The pure discriminated-draft reducer then passed
all empty, later, earlier, same-day, completed-restart, immutability, month, and
year comparisons. Formatter tests passed after using locale-owned
`Intl.DateTimeFormat.formatRange` punctuation.

The read-only summary, complete-range restart, and year-navigation component
tests first failed against the editable React Aria DateFields and two-button
header. They passed after DayPicker selection was routed through the reducer,
summaries replaced fields, and four controlled navigation buttons were added.
The same-day interaction exposed missing endpoint modifiers after an
interactive update; explicit public DayPicker range-start/range-end modifiers
made the selected day deterministic.

The AlertDialog backdrop regression first failed because the custom Overlay
handler invoked `onClose`. Removing custom backdrop close handlers made
AlertDialog retain Radix outside-dismissal semantics and left Dialog backdrop
and Escape actions producing one close request through `onOpenChange`.

### Verification

The final focused run passed 80/80 tests across the reducer, formatter, picker,
Overlay, and App/MSW integration files. `pnpm format`, `pnpm format:check`,
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm verify`
all passed. The workspace test run passed 155 Contracts, 234 API, and 153 Web
tests (542 total).

The production build transformed 1,343 modules and emitted a 617.04 kB client
chunk (194.11 kB gzip). Vite retained its non-failing greater-than-500-kB
chunk warning. The four relevant Chromium Playwright workflows passed in 6.9
seconds: desktop explicit Search/edit/Clear, mobile fixed-week adjacent dates,
keyboard cross-month selection, and French localization.

Final dependency and prohibited-pattern searches found no React Aria direct
imports, editable DateFields, incomplete-range translation, third-party state
mutation, pointer-anchor state, forced outside-month values, duplicate
backdrop close handler, debug logging, focused tests, or skipped tests. The
only known limitation is the existing client bundle-size warning; direct
month/year dropdown selection remains intentionally outside the assignment.

## Create Transaction maximum amount

### Prompt and implementation decision

Add a `999999999.99` limit when creating a transaction, add the corresponding
tests, and fix every red test. Preserve integer minor-unit money handling and
the existing Contracts-to-API/Web dependency direction.

The limit is represented exactly as `99,999,999,999` minor units and exported
from Contracts as `CREATE_TRANSACTION_MAX_MINOR_UNITS`. The strict Create
request schema enforces it at the API boundary, while the Web amount parser
and `CurrencyInput` use the same constant to reject an oversized value before
it can remain in the Create Transaction field or send a request. English and
French validation messages state the complete accepted range.

### Tests and diagnosis

Contract, Supertest, parser, and App/MSW tests cover the accepted maximum, the
first rejected minor unit, the first rejected whole-dollar input, the localized
message, and absence of an HTTP request for client-side rejection. CurrencyInput
component coverage proves that an oversized pasted draft leaves the prior valid
field value intact. A Playwright journey proves the full Create Transaction
overlay keeps the oversized paste out of the input, shows the range error, and
does not issue a create request. The new tests were observed failing before
implementation and passing afterward.

Three existing date-search App tests also failed on August 5 because their
blank-search month followed the real clock while their selected dates remained
hard-coded to July. The test file now mocks `today()` to its established July
27 scenario, making those tests deterministic without changing production date
behavior.

## Deterministic test-system hardening

### Prompt and root-cause diagnosis

Audit the complete test system for real-date failures and other latent red-test
risks, explain why real time entered the tests, and fix every problem found.

The failure was possible because the browser and App suites encoded July 2026
expectations while production calendar code correctly read the host's local
date. The tests did not own their clock, the Playwright configuration did not
own its timezone, and the repository's `verify` command did not run Playwright,
so the broad green gate could conceal four failing browser journeys after the
calendar crossed into August.

### Implementation

Playwright now installs one explicit July 27, 2026 Los Angeles time before each
test, uses the same explicit timezone in its browser context, and always starts
the configured test servers instead of silently attaching to an unrelated
server already using port 5173. `pnpm verify` now includes all Playwright
journeys.

Frontend response-ordering tests use controlled deferred requests instead of
real sleeps. Dynamic calendar and Overlay element lookup fails with descriptive
test errors instead of non-null assertions. Temporary spies are restored in
`finally`. Cross-process persistence tests apply independent message timeouts,
remove diagnostic listeners, and terminate child processes in `finally`;
elapsed-time assertions use the monotonic performance clock.

The testing strategy now records deterministic clock, timezone, synchronization,
and child-process cleanup requirements. ESLint rejects unparameterized dates,
`Date.now()`, bare Playwright clock installation, and Playwright wall-clock
sleeps in tests so the same class of defect cannot silently return.

### Verification

The focused Web run passed 50/50 tests and the focused API persistence/process
run passed 23/23 tests. The first full browser rerun passed 8/8 journeys. Final
`pnpm verify` passed formatting, ESLint, TypeScript, 157 Contracts tests, 235
API tests, 156 Web tests, all production builds, and 9/9 Chromium journeys. The
Web build retains the known non-failing 500 kB chunk-size warning.
