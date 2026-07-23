# Testing Strategy

## Objectives

Testing provides evidence that the system satisfies business rules, public contracts, infrastructure behavior, and user-visible workflows.

The strategy is risk-based rather than coverage-number-driven. Use the lowest test layer that can reliably observe the behavior, and use broader tests only where integration risk justifies them.

## TDD Rule for Observable Behavior

Before implementing or changing observable behavior:

1. Identify the contract, rule, or user outcome being changed.
2. Add or update a test that fails for the intended reason.
3. Confirm the failure represents missing or incorrect behavior rather than a broken test setup.
4. Implement the minimum code required to pass.
5. Refactor while keeping the test suite green.
6. Run focused tests, then affected workspace checks.

Configuration-only, documentation-only, and mechanical refactoring tasks do not require artificial tests. They still require the relevant verification commands.

## Test Layers

### Contract Tests

Use when changing:

- Request bodies.
- Response DTOs.
- Query parameters.
- Public enums or machine values.
- Public API error codes.
- Error envelopes.

Location:

- `packages/contracts`

Test:

- Valid examples parse.
- Invalid values are rejected.
- Required fields are enforced.
- Machine values are stable.
- Type inference remains aligned with the schema.

Contract tests should normally be written before endpoint implementation.

### Domain Unit Tests

Use when implementing pure business rules:

- Entity invariants.
- Value-object validation.
- State transitions.
- Eligibility policies.
- Domain calculations.

Test:

- Business inputs and outputs.
- Allowed transitions.
- Rejected transitions.
- Domain errors.
- Boundary values.

Do not involve Express, files, databases, HTTP status codes, or mocks of technical systems.

Domain rules should be developed test-first.

### Application Use-Case Tests

Use when implementing orchestration:

- Loading entities through a repository port.
- Handling not-found conditions.
- Calling domain behavior.
- Saving results.
- Coordinating a clock, identifier generator, or multiple dependencies.

Use focused fakes or in-memory adapters.

Test:

- Correct repository calls and outcomes.
- No save when a domain rule rejects the operation.
- Correct propagation or translation of known failures.
- Deterministic use of injected time or IDs.

Avoid tests whose only purpose is to assert every method-call detail. Assert observable use-case outcomes and important side effects.

### Infrastructure Integration Tests

Use when implementing or changing:

- JSON repositories.
- Filesystem behavior.
- Database repositories.
- Serialization and mapping.
- Atomic file replacement.
- External client adapters.

Use real temporary files or the real local technical boundary whenever practical.

For JSON persistence, test:

- Valid data can be loaded.
- Account and status filtering behave correctly.
- Writes survive a fresh read.
- Invalid JSON produces the defined failure.
- Structurally invalid records are rejected.
- Missing-file behavior is explicit.
- Temporary files and atomic replacement behave as designed where applicable.

Do not mock `fs` merely to prove that mocked functions were called if the real filesystem boundary can be tested safely in a temporary directory.

### HTTP Integration Tests

Use for every new or changed endpoint.

Tooling:

- Vitest.
- Supertest.

Exercise:

- Express route registration.
- Request validation.
- Controller mapping.
- Application use case.
- Error middleware.
- Response status and body.

At least one failing HTTP integration test must exist before production implementation of a new endpoint.

Test both the happy path and important protocol failures, such as:

- Invalid body or query returns 400.
- Missing resource returns 404.
- State conflict returns 409.
- Empty collections return 200 with an empty collection.
- Public response conforms to the contract.

Do not unit-test controllers with extensive Express mocks when a Supertest integration test can exercise the same behavior more reliably.

### React Component Tests

Use for user-visible component behavior.

Tooling:

- Vitest.
- React Testing Library.
- `@testing-library/user-event`.

Test through accessible, user-observable behavior:

- Content is visible.
- Controls can be operated.
- Loading, empty, success, and error states render correctly.
- Controls are enabled or disabled appropriately.
- Form validation feedback is associated with user input.

Do not assert:

- Internal component state.
- Exact hook call counts.
- Private helper functions.
- CSS class strings unless the class itself is the public behavior under test.

### Frontend HTTP Integration Tests

Use when testing a feature's interaction with the API.

Tooling:

- React Testing Library.
- MSW.

Exercise:

- Feature or page component.
- Native Fetch through the shared API client.
- Request URL and payload.
- Contract-shaped responses.
- Typed error handling.
- Retry or refresh behavior.

Prefer MSW over mocking global Fetch for network-level behavior. Pure presentational components may be tested with props and do not need MSW.

Unhandled MSW requests should fail tests unless a test explicitly permits them.

### End-to-End Tests

Use for critical complete user journeys after a vertical slice is functional.

Tooling:

- Playwright.

E2E tests should run the real Web and API applications and exercise the real configured persistence adapter appropriate to the test environment.

Keep the suite small and high-value. Suitable journeys include:

- Load transactions and filter by status.
- Create a transaction and observe that it remains after refresh.
- Reverse an eligible transaction and observe the persisted terminal state.

Do not reproduce every validation branch already covered by contract and HTTP integration tests.

## Regression Tests

Every confirmed bug should first receive a test that reproduces it.

Choose the layer closest to the root cause:

- Incorrect domain transition: domain test.
- Incorrect use-case save behavior: application test.
- Wrong HTTP status or public error: HTTP integration test.
- Persistence corruption: infrastructure integration test.
- Incorrect UI filtering: component test.
- Cross-layer persistence failure visible only after refresh: E2E test.

Keep the test permanently after the fix. Do not create a separate regression-test directory.

## Test Data

Prefer deterministic builders and fixtures.

- Use fixed IDs and timestamps unless randomness is the behavior under test.
- Use temporary directories for filesystem integration tests.
- Do not mutate checked-in seed data during tests.
- Keep fixtures focused on the scenario under test.
- Avoid large shared fixtures that obscure why a test passes.

## Mocking Policy

Mock only at a deliberate boundary.

Appropriate:

- Application tests using a repository fake.
- Component tests using props for presentational components.
- Frontend integration tests using MSW at the HTTP boundary.

Avoid:

- Mocking the method under test.
- Mocking Express internals instead of using Supertest.
- Mocking filesystem calls instead of using a temporary directory.
- Tests that only assert that a mock was invoked without validating the resulting behavior.

## Coverage

Coverage is a diagnostic tool, not the primary quality target.

Prioritize high branch coverage for:

- Domain rules.
- Application error paths.
- HTTP error mapping.
- Persistence failure handling.

Do not add meaningless tests solely to reach an arbitrary global percentage.

## Verification Workflow

During development:

1. Run the smallest focused test file or workspace test command.
2. Run the affected workspace typecheck and tests.
3. Before completion, run repository-level checks.

Required completion checks:

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm verify`

Run Playwright when the change affects a covered end-to-end journey or completes a vertical slice.

Do not claim a command passed unless it was actually executed successfully.
