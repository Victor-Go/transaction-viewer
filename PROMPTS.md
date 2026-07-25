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
