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

Domain and application errors contain no HTTP status codes. Map known internal
error types to statuses and centrally defined contract error codes at the HTTP
boundary. Map unknown failures to the safe `INTERNAL_ERROR` contract response.

## JSON Persistence

For the current assignment, transaction data must be persisted in
`apps/api/data/transactions.json`.

Application code accesses transaction persistence only through the transaction
repository port.
`JsonTransactionRepository` owns filesystem access, JSON parsing, validation,
record mapping, and writes.

Resolve the concrete file path at the API composition boundary and inject it
into the repository. Domain and application code must not know the file path or
access the filesystem directly.

Infrastructure integration tests must use isolated temporary files and must not
modify the repository's committed data file.

Do not introduce a generic JSON storage service unless a second concrete use
case demonstrates shared behavior that cannot remain inside its repositories.

## API Development

For a new or changed endpoint, follow the API-TDD sequence in
`docs/architecture/testing-strategy.md`: contract and contract tests first, then
at least one failing Supertest test, then applicable domain/application tests,
minimum implementation, and persistence integration tests when needed.

Use centralized error middleware for known failures. Controller unit tests are
optional when Supertest integration tests cover the same behavior at the more
useful boundary.

Keep `src/app.ts` responsible for creating and exporting the Express
application. Keep `src/server.ts` responsible for starting the listener; tests
that import the app must not open a port.

Run focused API and contract tests while developing, then the root verification
required for completion.
