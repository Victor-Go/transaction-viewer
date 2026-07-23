# Card Platform Repository Instructions

## Purpose and Scope

This repository is an extensible card-platform monorepo. Transaction Viewer is
the first business module, not the architectural boundary of the product.

Read the architecture documents before changing structure or observable
behavior:

- `docs/architecture/overview.md`
- `docs/architecture/dependency-rules.md`
- `docs/architecture/testing-strategy.md`

Before editing a file, apply this root guidance and every `AGENTS.md` from the
repository root down to that file. The closest file supplies workspace-specific
rules. When guidance conflicts, follow the closest applicable file unless it
would violate a repository-wide dependency rule.

## Repository Map

- `apps/api`: Express application, backend business modules, HTTP composition,
  and infrastructure assembly. See `apps/api/AGENTS.md`.
- `apps/web`: React/Vite browser application and feature-oriented UI. See
  `apps/web/AGENTS.md`.
- `packages/contracts`: shared public HTTP contracts used by API and Web. See
  `packages/contracts/AGENTS.md`.
- `tests/e2e`: high-value Playwright tests for complete user journeys.

Use feature-first organization. Backend modules belong under
`apps/api/src/modules/<module>`; frontend features belong under
`apps/web/src/features/<feature>`. Do not add a workspace package without a real
cross-application consumer or justified independent build boundary.

## Global Boundaries

- API and Web may depend on `@card-platform/contracts`.
- Contracts must not depend on API or Web.
- Web must not import backend domain, application, infrastructure, or HTTP code.
- Backend dependencies point inward: HTTP and infrastructure adapt application
  and domain abstractions; domain remains independent of frameworks, transport,
  persistence, and UI.
- Use declared pnpm workspace dependencies for cross-workspace imports. Use
  path aliases only within one workspace.
- Keep `apps/api/src/app.ts` responsible for creating and exporting the Express
  application and `apps/api/src/server.ts` responsible for starting the
  listener. Importing the app in tests must not open a port.

Do not introduce unrequested frameworks, databases, infrastructure platforms,
workspace packages, or architectural patterns.

## Current Persistence Scope

The current assignment requires JSON-file persistence. Treat JSON as the active
and required persistence mechanism for all assignment features.

Preserve replacement flexibility through application-owned repository ports and
infrastructure adapters, but do not introduce a database, ORM, migration system,
database client, Unit of Work, or database-oriented abstraction unless the
requirements explicitly change.

Future persistence replacement is an architectural possibility, not current
implementation scope.

## Development and Testing

Before changing observable behavior, add or update a test that fails for the
intended reason at the lowest effective layer. Follow
`docs/architecture/testing-strategy.md`, including its API-TDD sequence.
Documentation, formatting, and mechanical configuration changes do not require
meaningless tests; run the checks relevant to the files and commands affected.

Never weaken, delete, skip, or rewrite an approved test merely to make an
incorrect implementation pass. Do not create tests that only verify mocks or
private implementation details.

During development, run focused affected checks first. Before handing off a
completed implementation, run `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, affected tests, `pnpm build`, and `pnpm verify`, unless the
task documents a justified exception. Run relevant Playwright tests when a
complete user journey changes. Report only commands actually executed and any
remaining warnings or failures.

## Ambiguity and Decision Handling

Do not silently invent product behavior, public API semantics, persistence
guarantees, security rules, or architectural boundaries.

Ask the user before proceeding when an unresolved decision would materially
affect one or more of the following:

- public API compatibility
- business rules or financial semantics
- persistent data shape or migration requirements
- security, authorization, or privacy behavior
- architecture or workspace boundaries
- the scope or reviewability of the intended commit
- a trade-off with multiple reasonable options and no established repository
  convention

Do not stop for minor implementation choices that are local, reversible, and
already guided by repository conventions. In those cases, choose the smallest
reasonable implementation and report the assumption.

When asking a question:

1. State the unresolved decision clearly.
2. Explain why it matters.
3. Present the most reasonable options and their trade-offs.
4. Recommend one option.
5. Do not continue with the affected behavior until the decision is resolved,
   unless the user explicitly authorizes a provisional assumption.

After the user resolves an ambiguity, record the decision only when it has
lasting value:

- update an applicable AGENTS.md only for durable rules that future agents must repeatedly follow
- update module documentation for product assumptions, scope decisions, and feature-specific semantics
- use an architecture decision document for significant cross-cutting trade-offs
- update PROMPTS.md when the AI interaction materially influenced the design, implementation, or verification

Do not copy every user answer into AGENTS.md. Avoid duplicating the same decision
across multiple instruction and documentation files.

Before recording a newly resolved decision, inspect existing documentation and
update the single most appropriate source of truth. Do not create a new document
when an existing module or architecture document already owns that decision.

## Commit Readiness

When the user asks whether work is ready to commit:

1. Inspect the complete working-tree diff for unrelated changes and scope creep.
2. Check architecture and dependency boundaries and confirm new observable
   behavior has appropriate tests.
3. Run focused affected tests, then `pnpm verify`; run relevant Playwright tests
   when a complete user journey changed.
4. Check for secrets, generated artifacts, debug code, skipped tests, and
   focused tests.
5. Determine whether `README.md` and `PROMPTS.md` require updates.
6. Report unresolved warnings and propose one coherent Conventional Commit
   message.

Do not run this full protocol after every small edit, and do not create a commit
unless the user explicitly requests it.

## AI Development Record

Update `PROMPTS.md` for meaningful AI-assisted requirement interpretation,
architecture, contracts, test strategy, important implementation decisions, or
bug diagnosis. Record the objective, relevant context, result, human decision,
and verification performed. Do not record routine autocomplete or formatting.
