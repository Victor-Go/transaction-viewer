# Card Platform

A full-stack TypeScript monorepo for an extensible card platform. The transaction viewer will be the first business module, while the repository boundaries are designed to support additional card-platform capabilities.

## Requirements

- Node.js 24
- pnpm 11.9.0

## Workspaces

- `@card-platform/api` — Express 5 API application
- `@card-platform/web` — React and Vite web application
- `@card-platform/contracts` — shared Zod HTTP contracts

## Commands

```sh
pnpm dev
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify
```

`pnpm verify` checks formatting, linting, types, unit/integration tests, and builds. Playwright tests remain separate under `tests/e2e`.

## Architecture

API business modules live under `apps/api/src/modules`. A module may contain `domain`, `application`, `infrastructure`, and `http` layers as it gains real behavior. Only external HTTP contracts shared by applications belong in `packages/contracts`.

The web application is feature-oriented. Transaction-specific API access, state, and UI will live under `features/transactions`; transport-level Fetch behavior belongs under `shared/api`.
