# Card Platform Repository Instructions

## Purpose

This repository is an extensible card-platform monorepo. The Transaction Viewer is the first implemented business module, not the architectural boundary of the system.

The current deployable applications are:

- `apps/api`: Express API application.
- `apps/web`: React/Vite web application.

The current shared workspace package is:

- `packages/contracts`: shared external HTTP contracts used by both API and Web.

Read the relevant architecture documents before changing application structure or observable behavior:

- `docs/architecture/overview.md`
- `docs/architecture/dependency-rules.md`
- `docs/architecture/testing-strategy.md`

## Repository Map

### `apps/api`

Contains the backend application and backend business modules.

Business modules are organized under:

- `apps/api/src/modules/<module>`

A backend module may contain:

- `domain`: entities, value objects, invariants, domain services, and domain errors.
- `application`: use cases, orchestration, and ports required by the use cases.
- `infrastructure`: persistence and external-system adapters.
- `http`: Express routes, controllers, presenters, request mapping, and HTTP error mapping.

### `apps/web`

Contains the browser application.

Frontend business features are organized under:

- `apps/web/src/features/<feature>`

Shared browser infrastructure belongs under:

- `apps/web/src/shared`

### `packages/contracts`

Contains shared external HTTP contracts only:

- Zod request schemas.
- Zod response schemas.
- Query parameter schemas.
- API DTOs inferred from schemas.
- Stable public API error codes and error envelopes.

Do not place backend domain behavior, repository interfaces, React components, Express code, or persistence records in this package.

### `tests/e2e`

Contains high-value full-system browser tests. E2E tests should cover critical user journeys, not every branch already covered at lower levels.

## Global Dependency Rules

Maintain these dependency directions:

- `apps/web` may depend on `packages/contracts`.
- `apps/api` may depend on `packages/contracts`.
- `packages/contracts` must not depend on `apps/api` or `apps/web`.
- Backend domain code must not depend on Express, HTTP status codes, Zod transport schemas, filesystem APIs, database drivers, React, or browser APIs.
- Backend application code must not depend on Express `Request` or `Response` objects.
- Infrastructure may depend inward on domain/application abstractions.
- HTTP adapters may depend inward on application use cases and contract schemas.
- Frontend code must not import backend domain or application modules.

Use pnpm workspace dependencies for cross-workspace imports. Path aliases may be used only for imports within the same workspace package.

## Development Rules

- Prefer feature-first organization over global technical dumping grounds.
- Do not create generic `utils`, `services`, `helpers`, or `common` directories unless the code has a clear, stable responsibility and more than one genuine consumer.
- Do not create new workspace packages without a real cross-application consumer or a clearly justified independent build boundary.
- Do not introduce new frameworks, databases, infrastructure platforms, or architectural patterns without explicit approval.
- Keep `apps/api/src/app.ts` responsible for creating and exporting the Express application.
- Keep `apps/api/src/server.ts` responsible for starting the HTTP listener.
- Importing the Express application in tests must not open a network port.
- Keep API machine values stable and separate from user-facing labels.
- Do not expose persistence implementation details through public API contracts.

## API and Contract Rules

Before implementing or changing an API endpoint:

1. Define or update the shared HTTP contract when the request, response, query, or public error shape changes.
2. Add or update contract tests.
3. Add at least one failing Supertest integration test that describes the endpoint's externally observable behavior.
4. Add domain or application tests before implementing new business rules or use-case branches.
5. Implement the minimum production code required to satisfy the approved tests.
6. Add infrastructure integration tests whenever persistence behavior is introduced or changed.
7. Run focused tests first, then all affected workspace checks.

Controllers and routes must:

- Validate transport input.
- Map HTTP input to application input.
- Call the required use case.
- Map domain/application results to response DTOs.
- Delegate known failures to a centralized HTTP error mapper.

Controllers and routes must not:

- Read or write persistence directly.
- Contain domain eligibility rules.
- Mutate domain state directly.
- Invent one-off error response shapes.
- Match human-readable error messages to determine behavior.

Public API error handling must keep these concepts separate:

- Domain or application error type.
- Stable public API error code.
- HTTP status code.
- Human-readable message.

Public behavior must be selected by error type or stable error code, never by matching message text.

## Testing Rules

Before changing observable behavior, add or update a test that fails for the intended reason.

Choose the lowest effective test layer that observes the behavior:

- Contract change: contract test.
- Domain invariant: domain unit test.
- Use-case orchestration: application unit test.
- Repository or filesystem behavior: infrastructure integration test.
- Endpoint behavior: Supertest HTTP integration test.
- User-visible React behavior: Testing Library component test.
- Frontend HTTP integration: Testing Library plus MSW.
- Critical end-to-end user journey: Playwright.
- Bug fix: first add a regression test at the layer closest to the root cause.

Do not create tests that only verify mocks or implementation details.

Do not weaken, delete, skip, or rewrite an approved test merely to make an incorrect implementation pass.

Regression is a purpose, not a separate test directory. Keep regression tests at the appropriate unit, integration, component, or E2E layer.

## Definition of Done

A task is complete only when:

- The requested behavior is implemented without unrelated scope expansion.
- Relevant focused tests pass.
- Contract changes are reflected in both schema and inferred types.
- `pnpm format:check` passes.
- `pnpm lint` passes.
- `pnpm typecheck` passes.
- Relevant tests pass.
- `pnpm build` passes.
- `pnpm verify` passes unless the task explicitly documents a justified exception.
- Tests were not weakened to accommodate the implementation.
- Documentation is updated when architecture, contracts, commands, or important assumptions change.

## AI Development Record

Record meaningful AI-assisted work in `PROMPTS.md` when it affects:

- Requirement interpretation.
- Architecture.
- API contracts.
- Test strategy.
- Important implementation decisions.
- Bug diagnosis or regression prevention.

Each record should include the prompt objective, context, result, human decision, and actual verification performed.

Do not record routine autocomplete or trivial formatting assistance.
