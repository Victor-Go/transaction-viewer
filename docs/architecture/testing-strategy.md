# Testing Strategy

## Principle

Use the lowest test layer that reliably observes the behavior. Add broader tests
only for meaningful integration risk. Coverage is diagnostic evidence, not a
reason to write tests without behavioral value.

Before changing observable behavior, add or update a test that fails for the
intended reason, implement the minimum behavior, then refactor while keeping the
suite green. Documentation, formatting, and mechanical configuration changes
do not require artificial tests, but still require relevant verification.

## Test Layers

### Contract tests

Use Zod schemas as the source of truth and infer public TypeScript types from
them. Runtime contract tests verify parsing behavior; repository type checking
verifies compile-time usage.

### Domain unit tests

Use for entities, value objects, invariants, calculations, eligibility rules,
state transitions, and domain errors. Exercise pure business inputs, outputs,
boundaries, and rejected transitions without Express, HTTP, files, or technical mocks.

### Application use-case tests

Use for orchestration through repository or gateway ports: loading, not-found
handling, calling domain behavior, saving, and coordinating clocks or ID
generators. Prefer focused fakes. Assert outcomes and important side effects,
not exhaustive mock call sequences.

### Infrastructure integration tests

Use for repository, filesystem, serialization, mapping, atomic-write,
or external-adapter behavior. Prefer the real local boundary with isolated
temporary resources. Test defined failure behavior and prove writes survive a
fresh read. Do not mock filesystem calls when a safe temporary-directory test
can observe the behavior.

### HTTP integration tests

Use Vitest and Supertest for every new or changed endpoint. Exercise route
registration, validation, controller mapping, use-case invocation, error
middleware, status, and contract-shaped body. Cover the happy path and important
protocol failures. Controller unit tests are not required when HTTP integration
tests provide the appropriate coverage; avoid extensive Express mocks.

### React component tests

Use Vitest, React Testing Library, and `user-event` for user-visible component
behavior. Assert accessible content, interaction, loading, empty, success, and
error states. Avoid private hook state, helper internals, exact call counts, and
exact CSS class names unless a class is itself public behavior.

### MSW frontend integration tests

Use Testing Library plus MSW when testing a feature through its HTTP boundary.
Exercise native Fetch through `shared/api`, contract-shaped requests and
responses, typed failures, and retry or refresh behavior. Do not mock Fetch
directly when network-level behavior is the subject. Unhandled requests should
fail unless deliberately permitted.

### Playwright E2E tests

Use for a small set of critical complete browser-to-API journeys with the real
configured test applications and persistence adapter. Do not repeat every
validation branch already covered below the E2E layer.

### Regression tests

For each confirmed bug, first reproduce it at the layer closest to its root
cause and keep the test after the fix. Regression describes purpose, not a
separate directory.

## API TDD Sequence

Before implementing or changing an API endpoint:

1. Define or update the shared HTTP contract.
2. Add contract tests for new request, response, query, or error shapes.
3. Add at least one failing Supertest integration test describing externally
   observable behavior.
4. Add domain or application tests before implementing new business rules or
   use-case branches.
5. Implement the minimum behavior required.
6. Add infrastructure integration tests when persistence behavior is
   introduced or changed.
7. Run focused tests and then all affected tests.

Do not weaken, skip, or rewrite an approved test to accommodate incorrect
production behavior.

## Test Data and Verification

Use deterministic IDs and timestamps, focused builders, temporary directories
for filesystem tests, and immutable checked-in seed data. Mock only at deliberate
boundaries.

During development, run the smallest relevant test first, followed by affected
workspace checks. Before completion, follow the repository verification
expectations in the root `AGENTS.md`. Run Playwright when a covered complete
journey changes or a vertical slice becomes functional. Never report a command
as passing unless it was executed successfully.
