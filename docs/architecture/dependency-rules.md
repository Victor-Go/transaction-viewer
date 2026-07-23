# Dependency Rules

## Direction

Dependencies point from delivery and technical details toward business
abstractions:

```text
Web ───────────────> Contracts <────────────── HTTP
                                               │
Infrastructure ─────> Application ─────────> Domain
```

HTTP and infrastructure are sibling adapters. Infrastructure implements ports
owned by application; HTTP invokes application use cases. Neither adapter owns
business policy.

## Workspace Boundaries

Allowed:

- `apps/api` and `apps/web` importing `@card-platform/contracts`.
- Each workspace importing third-party libraries appropriate to its runtime.
- Path aliases resolving only within the same workspace.

Forbidden:

- Contracts importing API or Web.
- Web importing any backend layer.
- Relative filesystem imports across workspaces.
- TypeScript path aliases impersonating pnpm workspace packages.

Declare cross-workspace dependencies with `workspace:*`.

## Backend Boundaries

### Domain

Domain may use language features and other domain code in its module. It must
not depend on Express, HTTP concepts, transport schemas, filesystem APIs, environment variables, React, browser APIs, or infrastructure
implementations. Business decisions receive required information through
arguments or domain collaborators.

### Application

Application may depend on domain types and ports owned by its use cases. It
must not depend on Express objects, route/query representations, HTTP status
codes, JSON or database implementation details, concrete adapters, React, or
browser APIs. Persistence is accessed through injected ports.

### Infrastructure

Infrastructure may depend inward on application ports and domain types and may
use filesystem APIs or external SDKs. It maps technical records to
internal models. It must not decide HTTP responses, contain controller behavior,
or expose persistence records as public DTOs.

### HTTP

HTTP may depend on Express, shared contracts, application use cases, and
internal error types needed for mapping. It validates and maps transport input,
invokes use cases, presents contract-shaped output, and centrally maps known
failures. It must not access persistence, implement business rules, mutate
domain state directly, or leak infrastructure failures.

## Frontend Boundaries

- `shared/api` owns generic Fetch transport, safe response parsing, abort,
  network, protocol, and HTTP error normalization. It does not choose
  feature-specific meaning or UI behavior.
- `features/<feature>/api` calls endpoints through `shared/api`.
- `features/<feature>/model` coordinates hooks and feature state without
  becoming the final authority for backend business rules.
- `features/<feature>/ui` renders user-visible behavior and consumes feature
  model/API abstractions. It does not branch on human-readable error messages.

## Public Error Boundary

Keep these concepts separate:

1. Domain or application error type.
2. HTTP adapter mapping.
3. Stable public error code from `@card-platform/contracts`.
4. HTTP status.
5. Human-readable message.

Internal errors contain no HTTP status. HTTP adapters select the public code and
status by stable error type, never by matching message text. Infrastructure
details are not public. Unknown failures use the safe, centrally defined
`INTERNAL_ERROR` response. Clients branch on stable codes or typed transport
categories, not messages.

## Review Questions

- Can domain code run without Express, transport schemas, or persistence?
- Can persistence be replaced without changing controllers or business rules?
- Does every cross-workspace import have a declared workspace dependency?
- Are public DTOs defined once in contracts and mapped at boundaries?
- Are known errors mapped centrally at the HTTP boundary?

## Current Persistence Boundary

JSON-file persistence is the required concrete implementation for the current
assignment.

Allowed:

- Infrastructure reading and validating JSON files.
- Infrastructure mapping JSON records to domain models.
- Application use cases depending on repository ports.
- Composition code injecting the JSON repository into use cases.

Forbidden:

- Domain or application code importing filesystem APIs or JSON record schemas.
- Controllers reading JSON files directly.
- Public contracts exposing persistence record shapes.
- Adding a database, ORM, migrations, Unit of Work, or database-specific
  abstractions without an explicit requirement change.

The repository port preserves the option to replace the JSON adapter later; it
does not justify implementing alternative persistence now.
