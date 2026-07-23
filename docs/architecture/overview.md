# Architecture Overview

## System Shape

The repository is an extensible card-platform monorepo implemented initially as a modular monolith.

The Transaction Viewer is the first business capability. Future capabilities may include accounts, cards, authorizations, refunds, disputes, ledger operations, notifications, and identity. These future modules are architectural possibilities, not placeholders that should be created before they are needed.

The current system consists of:

- A React/Vite browser application.
- An Express API application.
- A shared HTTP-contract package.
- End-to-end browser tests.

## Repository Structure

### Deployable applications

`apps/api`

The backend application. It owns backend modules, HTTP composition, process startup, and infrastructure assembly.

`apps/web`

The browser application. It owns user interface composition, browser-side state, API calls, and presentation behavior.

### Shared package

`packages/contracts`

The shared external HTTP protocol between API and Web. It is not a backend domain package.

### System tests

`tests/e2e`

Playwright tests that exercise the complete browser-to-API path for critical user journeys.

## Backend Architecture

The API uses feature-first modular organization. Each business module is internally separated into four responsibilities:

### Domain

Contains business meaning and invariants:

- Entities.
- Value objects.
- Domain rules.
- Domain services where a rule does not naturally belong to one entity.
- Domain errors.

Domain code is independent of Express, HTTP, Zod transport schemas, persistence technology, and browser concerns.

### Application

Contains use cases and orchestration:

- Commands and queries.
- Repository or gateway ports required by use cases.
- Coordination of domain objects.
- Transaction boundaries when required.

Application code receives plain typed input and returns domain or application results. It does not receive Express request or response objects.

### Infrastructure

Contains adapters for technical systems:

- JSON persistence.
- Database repositories if introduced later.
- External service clients.
- Persistence record schemas and mappers.

Infrastructure implements abstractions required by the application layer.

### HTTP

Contains the Express adapter:

- Route registration.
- Request validation.
- Controller logic.
- Mapping from HTTP inputs to application inputs.
- Mapping from domain/application results to API DTOs.
- Mapping from known errors to HTTP status codes and public error responses.

The HTTP layer owns protocol semantics. Domain code does not know that a particular error maps to HTTP 409 or a particular public error code.

## Frontend Architecture

The web application uses feature-oriented organization.

### Feature API

Feature-specific HTTP functions belong under the relevant feature, for example:

- `features/transactions/api`

These functions call the shared typed Fetch client and use contracts from `@card-platform/contracts`.

### Feature Model

Hooks and browser-side coordination belong under:

- `features/transactions/model`

This layer handles loading, error, retry, filtering, and operation state for the feature.

### Feature UI

User-visible React components belong under:

- `features/transactions/ui`

Components should be tested through observable user behavior rather than internal state or implementation details.

### Shared Browser Infrastructure

Generic browser transport code belongs under:

- `shared/api`

Reusable UI components belong under:

- `shared/ui`

A component should move to `shared/ui` only after genuine reuse appears. Do not build a speculative design system.

## Contracts and Domain Models

The backend domain model and public API DTOs are distinct concepts.

Domain models represent business state and behavior.

Contracts represent data crossing the HTTP boundary.

Even when their fields are initially similar, conversions should remain explicit enough that internal changes do not accidentally become public protocol changes.

Zod schemas are the source of truth for public request and response shapes. TypeScript contract types should normally be inferred from those schemas.

## Composition and Dependency Injection

Technical dependencies are created at the application edge and injected inward.

A repository implementation receives its filesystem or database client.

A use case receives a repository interface, clock, identifier generator, or other required port.

A controller receives the use case it invokes.

The application must not rely on hidden global database or filesystem access from domain functions.

For ordinary persistence, repository implementations may hold a connection pool or file-path dependency. If a future use case requires one atomic transaction across multiple repositories, introduce an explicit Unit of Work only when that need exists.

## Evolution Strategy

Keep the system as a modular monolith while one API process is sufficient.

Extract a backend module into a separate workspace package or service only when there is a concrete need, such as:

- More than one backend application consumes the same domain/application module.
- Independent deployment is required.
- Ownership or release cadence requires a stronger boundary.
- Runtime scale or reliability requirements justify service separation.

Do not create package or service boundaries solely to imitate a large production architecture.
