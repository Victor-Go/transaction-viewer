# Architecture Overview

## System Shape

The repository is an extensible card platform implemented initially as a
modular monolith. Transaction Viewer is the first business capability, not the
boundary of the product. Future capabilities should be added only in response
to real requirements; do not create placeholder modules, packages, or services.

The current system consists of:

- `apps/api`: the Express backend application.
- `apps/web`: the React/Vite browser application.
- `packages/contracts`: the shared public HTTP protocol.
- `tests/e2e`: Playwright coverage for critical browser-to-API journeys.

## Backend Organization

Backend business modules live under `apps/api/src/modules/<module>` and use four
responsibilities:

- `domain`: entities, value objects, business rules, domain services, and domain
  errors.
- `application`: use cases, orchestration, and ports required by those use
  cases.
- `infrastructure`: persistence and external-system adapters.
- `http`: Express routes, controllers, validation, presenters, and error
  mapping.

This is a dependency shape, not a requirement to create empty directories.
Technical dependencies are assembled at the application edge and injected
inward: adapters implement application ports, use cases receive those ports,
and controllers receive use cases.

Keep `app.ts` as the import-safe Express composition entry point and `server.ts`
as the process entry point that starts listening.

The current transaction persistence adapter stores records in the selected JSON
database file, defaulting to `apps/api/data/default.json`. The file path is
supplied at the API composition boundary, while application use cases depend
only on the repository port. This keeps JSON-specific parsing and filesystem
behavior inside infrastructure and allows a future adapter to replace it
without changing business logic.

## Frontend Organization

Frontend business capabilities live under
`apps/web/src/features/<feature>`:

- `api`: feature-specific endpoint calls.
- `model`: hooks and feature-state coordination.
- `ui`: user-visible React components.

Generic Fetch transport belongs in `apps/web/src/shared/api`. Reusable UI may
move to `shared/ui` after genuine reuse exists; do not build a speculative
design system.

The Transaction frontend's routing, overlay stack, styling boundaries,
idempotency lifecycle, reconciliation, and polling design are documented in
[`frontend-transactions.md`](./frontend-transactions.md).

## Contracts and Internal Models

`packages/contracts` is the single shared definition of the external HTTP
protocol. Zod schemas define public request, response, query, and error shapes;
TypeScript DTO types are inferred from those schemas.

Public DTOs and backend domain models remain distinct even when their fields
initially look alike. Explicit boundary mapping prevents internal model or
persistence changes from becoming accidental protocol changes.
