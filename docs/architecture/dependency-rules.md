# Dependency Rules

## Purpose

These rules protect business logic from framework, transport, persistence, and UI coupling. Directory names are secondary; the dependency direction is the enforceable design constraint.

## Workspace-Level Rules

Allowed:

- `apps/api` may import `@card-platform/contracts`.
- `apps/web` may import `@card-platform/contracts`.
- API and Web may import third-party libraries appropriate to their runtime.

Forbidden:

- `packages/contracts` importing from `apps/api`.
- `packages/contracts` importing from `apps/web`.
- `apps/web` importing backend domain, application, infrastructure, or HTTP modules.
- Cross-workspace imports through relative filesystem paths.
- TypeScript `paths` entries that impersonate pnpm workspace packages.

Use `workspace:*` for local package dependencies. Path aliases are allowed only within one workspace package.

## Backend Module Rules

Assume a module structure containing `domain`, `application`, `infrastructure`, and `http`.

### Domain

May depend on:

- TypeScript and JavaScript standard language features.
- Other domain files within the same module.
- Carefully justified shared domain primitives if such a package exists later.

Must not depend on:

- Express.
- HTTP status codes or headers.
- Zod HTTP contract schemas.
- Filesystem APIs.
- Database clients or ORMs.
- Environment variables.
- React or browser APIs.
- Infrastructure implementations.

Domain entities and functions receive all information required to make a business decision through arguments, constructors, or domain collaborators. They do not query persistence directly.

### Application

May depend on:

- Domain entities, value objects, and domain errors.
- Ports or interfaces required by use cases.
- Other application files within the same module.

Must not depend on:

- Express request or response objects.
- Route params or query objects.
- HTTP status codes.
- Concrete filesystem or database implementations.
- React or browser APIs.

Application use cases may query persistence only through injected repository or gateway interfaces.

### Infrastructure

May depend on:

- Domain types required for mapping.
- Application ports it implements.
- Filesystem APIs, database clients, or external SDKs.

Must not:

- Decide public HTTP response shapes.
- Contain controller behavior.
- Expose persistence records directly as public DTOs.
- Import frontend code.

Infrastructure converts between persistence records and domain models through explicit mappers where the representations differ.

### HTTP

May depend on:

- Express.
- Shared HTTP contracts.
- Application use cases.
- Domain/application error types required for mapping.
- Presenters or DTO mappers.

Must not:

- Read or write persistence directly.
- Reimplement domain rules.
- Mutate entity state outside an application use case.
- Return persistence records without protocol mapping.
- Create inconsistent one-off error envelopes.

## Frontend Rules

### `features/<feature>/api`

May depend on:

- `shared/api`.
- `@card-platform/contracts`.

Must not:

- Render UI.
- Manage React component state.
- Import backend modules.

### `features/<feature>/model`

May depend on:

- Feature API functions.
- Contract types.
- React hooks.

Must not:

- Duplicate backend domain authorization or eligibility rules as the final authority.
- Handle raw Fetch responses directly when the shared API client already standardizes them.

### `features/<feature>/ui`

May depend on:

- Feature model/hooks.
- Contract or view-model types.
- Shared UI components.

Must not:

- Call persistence.
- Import Express or backend modules.
- Match error-message text to make program decisions.

### `shared/api`

Responsible for transport-level behavior:

- Calling native Fetch.
- Applying common headers.
- Checking HTTP success.
- Parsing optional JSON safely.
- Distinguishing abort, network, protocol, and HTTP errors.
- Preserving stable public API error codes.

Must not:

- Render toasts.
- Navigate.
- Mutate React state.
- Choose feature-specific user-facing messages.

## Contract Rules

`packages/contracts` is the public protocol boundary.

It may contain:

- Zod schemas for requests, responses, query parameters, and public errors.
- TypeScript types inferred from those schemas.
- Stable API machine values.

It must not contain:

- Backend entities with behavior.
- Repository interfaces.
- Use cases.
- Express middleware.
- React hooks or components.
- Persistence record schemas unless the persistence format is itself a public protocol, which it is not here.

Do not maintain a manually duplicated TypeScript interface and Zod schema for the same public shape unless the difference is explicit and documented.

## Error Dependency Rules

Keep these layers separate:

1. Domain/application error type.
2. HTTP error mapping.
3. Stable public API error code.
4. HTTP status code.
5. Human-readable message.

Example conceptual mapping:

- Domain/application failure: transaction is not reversible.
- Public code: `TRANSACTION_NOT_REVERSIBLE`.
- HTTP status: `409`.
- Message: explanatory text for the caller.

The domain must not import public API error codes or HTTP status codes.

The frontend must branch on stable public error codes or typed error categories, not human-readable messages.

## Database and Persistence Context

Domain entities do not obtain database connections.

The outer application bootstrap creates technical clients and adapters, then injects them inward:

- Database pool or file path into repository implementation.
- Repository implementation into application use case.
- Use case into HTTP controller.

If one use case later needs a single atomic transaction across multiple repositories, prefer an explicit Unit of Work callback or context. Do not introduce request-global or AsyncLocalStorage-based database context until a concrete need justifies the hidden dependency.

## Review Checklist

Before accepting a change, verify:

- Could the domain code run without Express and without a database?
- Could Express be replaced without changing domain/application code?
- Could JSON persistence be replaced without changing the controller or domain rules?
- Does every cross-workspace import correspond to a declared workspace dependency?
- Are public DTOs defined in contracts rather than copied separately in API and Web?
- Are known errors mapped in one HTTP boundary rather than scattered across controllers?
