## Initialization Prompts

```
Initialize a full-stack TypeScript monorepo in the current directory.

The repository represents an extensible card platform. The transaction viewer
is only the first business module, not the architectural boundary of the entire
project.

For this task, only initialize the repository structure, workspace packages,
development tooling, and minimal application shells.

Do not implement transaction business logic, API endpoints, JSON persistence,
forms, transaction tables, filtering, or reversal behavior yet.

## Technology stack

Use:

- Node.js 24
- pnpm workspaces
- TypeScript with strict mode
- ESM modules
- React with Vite
- Express 5
- Zod for shared HTTP contracts
- Native Fetch API for future frontend API calls
- CSS Modules
- Vitest
- Supertest
- React Testing Library
- @testing-library/user-event
- MSW
- Playwright
- ESLint
- Prettier

## Workspace structure

Create three private pnpm workspace packages:

- @card-platform/api
- @card-platform/web
- @card-platform/contracts

Use this directory structure:

.
├── apps/
│   ├── api/
│   │   ├── data/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   └── transactions/
│   │   │   ├── shared/
│   │   │   │   └── http/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── App.tsx
│       │   │   └── main.tsx
│       │   ├── features/
│       │   │   └── transactions/
│       │   │       ├── api/
│       │   │       ├── model/
│       │   │       └── ui/
│       │   └── shared/
│       │       ├── api/
│       │       └── ui/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── contracts/
│       ├── src/
│       │   ├── common/
│       │   ├── transactions/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── tests/
│   └── e2e/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
├── playwright.config.ts
├── .gitignore
└── README.md

Do not create separate workspace packages for:

- transaction domain
- JSON persistence
- test utilities
- UI components

The transaction domain belongs inside:

apps/api/src/modules/transactions/domain

Create a separate package only when code has a real cross-application consumer.
For now, only HTTP contracts are shared between the API and web applications.

## Architecture boundaries

Use the following intended API module structure:

domain/
- Business entities, value objects, rules, and domain errors
- Must not depend on Express, HTTP, JSON files, React, or Zod contracts

application/
- Transaction use cases
- Must not depend on Express Request or Response objects

infrastructure/
- Repository implementations and external infrastructure
- JSON persistence will be added later

http/
- Express routes, request mapping, response mapping, and HTTP error mapping

The API application should eventually follow:

HTTP route
  -> application use case
  -> domain
  -> repository abstraction
  -> infrastructure implementation

The web application should use feature-oriented organization:

features/transactions/api
- Transaction-specific API functions

features/transactions/model
- Hooks and UI state

features/transactions/ui
- React components for the transaction feature

shared/api
- Generic typed Fetch client and transport-level errors

shared/ui
- Reusable UI components only when genuine reuse exists

The contracts package should contain only shared external HTTP contracts:

- Zod request schemas
- Zod response schemas
- API DTOs
- Query schemas
- Common API error schemas

It must not contain:

- Express code
- React code
- backend domain rules
- repository implementations
- application use cases

## Basic configuration

Configure:

- TypeScript strict mode across all workspaces
- ESM across all workspaces
- CSS Modules support through Vite
- Vitest for API, web, and contracts
- jsdom for web tests
- Supertest support for API integration tests
- React Testing Library setup
- MSW setup for future frontend API tests
- Playwright configuration using tests/e2e

Keep these API entry-point responsibilities separate:

- app.ts creates and exports the Express application
- server.ts starts the HTTP listener

Do not start the server when app.ts is imported by tests.

## Root scripts

Add root commands for:

- pnpm dev
- pnpm lint
- pnpm format
- pnpm format:check
- pnpm typecheck
- pnpm test
- pnpm test:e2e
- pnpm build
- pnpm verify

The root scripts should delegate to workspace scripts using pnpm workspace
commands. Do not add Nx or Turborepo task orchestration.

`pnpm verify` should run:

1. format:check
2. lint
3. typecheck
4. test
5. build

Keep Playwright E2E tests separate from the standard verify command.

## Minimal application shells

Create only enough code to verify that:

- The Express application can be imported and started
- A basic health endpoint may return a simple success response
- The React application renders a minimal application shell
- The contracts package exports a minimal placeholder schema
- API, web, and contracts tests can run
- All workspaces can build successfully

Do not add transaction domain models or transaction contracts during this
initialization task.

Avoid placeholder abstractions, generic service classes, empty repositories,
unnecessary dependency-injection containers, or speculative future modules.

## Package configuration

All package.json files must contain:

- "private": true
- clear package names
- appropriate workspace scripts
- only dependencies required by that workspace

Use workspace dependencies such as:

"@card-platform/contracts": "workspace:*"

Do not use TypeScript path aliases as a replacement for actual pnpm workspace
dependencies.

Set the root packageManager field to the exact pnpm version used.

## Completion

After initialization:

1. Install dependencies
2. Run formatting checks
3. Run linting
4. Run TypeScript type checking
5. Run tests
6. Run builds
7. Run pnpm verify

Report:

- The resulting repository tree
- The created workspace packages
- The main configuration decisions
- The validation commands executed
- Any failures or unresolved warnings

Stop after repository initialization. Do not continue implementing the
transaction module.
```

### Result

Initialized a private pnpm TypeScript monorepo with Express API, React/Vite web,
and shared Zod contracts workspaces. Added strict ESM configuration, minimal
application shells, testing tools, and repository-wide development commands
without transaction business functionality.

### Follow-up fixes

Added the Vite `/api` development proxy and fixed port 5173, expanded root lint
coverage, separated Node and browser ESLint globals, enabled React Hooks and
React Refresh linting, and split type-checking from production build configs so
tests are checked but never emitted.

### Verification

- pnpm format:check: passed
- pnpm lint: passed
- pnpm typecheck: passed
- pnpm test: passed
- pnpm build: passed
- pnpm verify: passed
