# API Workspace Instructions

Apply the root `AGENTS.md` and architecture documents before this file. Backend
business modules use `src/modules/<module>/{domain,application,infrastructure,http}`
as responsibilities; create only the directories a real capability needs.

## Layer Responsibilities

### Domain

Owns entities, value objects, domain rules, domain services, and domain errors.
It must not depend on Express, HTTP status codes, React, filesystem access,
transport schemas, or persistence implementations.

### Application

Owns use cases, orchestration, and repository or gateway ports required by those
use cases. It receives plain typed inputs. It must not depend on Express
`Request` or `Response`, JSON record shapes, or concrete
persistence implementations.

### Infrastructure

Owns repository and external-system adapters. It may depend inward on
application ports and domain types. Keep persistence records and technical
exceptions inside this layer and map them explicitly at its boundaries.

### HTTP

Owns Express routes and controllers, contract-based request validation and
mapping, presenters, and centralized HTTP error mapping. It invokes application
use cases and returns contract-shaped responses; it contains no core business
rules.

Controllers and middleware must not:

- Access JSON files or other persistence directly.
- Contain transaction eligibility or other domain rules.
- Invent arbitrary response shapes.
- Invent inline public API error-code string literals.
- Select behavior by matching human-readable error messages.
- Expose raw infrastructure exceptions or implementation details.
- Import repository-adapter errors. Adapter-originated client-visible
  conditions use application-owned error types.

Domain and application errors contain no HTTP status codes. Map known internal
error types to statuses and centrally defined contract error codes at the HTTP
boundary. Map unknown failures to the safe `INTERNAL_ERROR` contract response.
Public error-code values come from `@card-platform/contracts`.

## JSON Persistence

For the current assignment, transaction data is persisted in the runtime-
selected JSON file. The default is `apps/api/data/default.json`; explicit
selection follows the documented `--database-file` then `DATABASE_FILE`
precedence. Demo data must not be silently seeded into explicitly selected
files.

Application code accesses transaction persistence only through the transaction
repository port.
`JsonTransactionRepository` owns filesystem access, JSON parsing, validation,
record mapping, and writes.

Resolve the concrete file path at the API composition boundary and inject it
into the repository. Domain and application code must not know the file path or
access the filesystem directly.

Infrastructure integration tests must use isolated temporary files and must not
modify the repository's committed data file.

Runtime JSON files under `apps/api/data` are generated and ignored. The
deterministic default demo dataset is created only when the missing default
database is first initialized; explicit files seed only when explicitly
requested, and existing files are preserved.

Core infrastructure depends only on the shared `Logger` abstraction. Pino is
restricted to the outer logging adapter and composition boundary. Never log
transaction records, account IDs, merchant names, amounts, cursor payloads,
credentials, connection strings, complete database documents, or absolute
database paths.

The reusable `src/shared/persistence/json` component is an infrastructure
utility for JSON repository adapters. Domain and application layers must not
import `JsonFileDatabase`; repository ports remain the replaceable persistence
boundary. Its typed internal storage errors are not public API error codes.

Database paths are canonicalized through their real parent directory; that
canonical target keys both the process-local mutex and `proper-lockfile`.
Target database files must not be symlinks. The process-local mutex does not
coordinate multiple processes, and all mutation read-modify-write work occurs
while both locks are held. `proper-lockfile` uses a 5-second stale threshold,
1-second updates, and an approximately 10-second acquisition window.

Persisted documents must be JSON-safe, survive an equivalent validated JSON
round-trip, and remain within 1 MiB. Transaction callbacks must remain
synchronous and side-effect free: thrown errors abort without commit, and
Promise-like results are rejected. For this take-home implementation, a
successful atomic replacement or no-op determines mutation success; a later
lock-release failure is not surfaced to the storage caller and may delay later
work until stale-lock recovery.

## API Development

For a new or changed endpoint, follow the API-TDD sequence in
`docs/architecture/testing-strategy.md`: contract and contract tests first, then
at least one failing Supertest test, then applicable domain/application tests,
minimum implementation, and persistence integration tests when needed.

Use centralized error middleware for known failures. Controller unit tests are
optional when Supertest integration tests cover the same behavior at the more
useful boundary.

Keep `src/app.ts` responsible for creating the Express application from
required, fail-fast dependencies. Keep `src/server.ts` responsible for starting
the listener; tests that import the app must not open a port or initialize
persistence.

Run focused API and contract tests while developing, then the root verification
required for completion.
