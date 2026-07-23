# Contracts Workspace Instructions

Apply the root `AGENTS.md` and architecture documents before this file.
`@card-platform/contracts` is the single source of truth for public HTTP
contracts shared by API and Web.

## Allowed Content

- Zod request and response schemas.
- Query parameter schemas.
- Public API DTOs.
- Public API error-code schemas.
- Common public error envelopes.
- TypeScript types inferred from Zod schemas.

Keep Zod schemas authoritative. Do not maintain a manually duplicated interface
for the same public shape unless the difference is intentional and documented.

## Disallowed Content

- Backend domain entities, behavior, or policies.
- Repository interfaces or persistence ports.
- Application use cases.
- Express middleware, routes, or controllers.
- React hooks or components.
- JSON persistence records.

Persistence representation is internal even when it resembles an API DTO.

## Public Error-Code Governance

- Define every public API error code centrally in
  `@card-platform/contracts`.
- Controllers and middleware must not invent error-code string literals.
- Add a contract test for every new public API error code.
- Clients branch on stable error codes, not human-readable messages.
- Domain and application errors contain no HTTP status codes.
- HTTP adapters map internal error types to statuses and public error codes.
- Never expose infrastructure error details publicly.
- Map unknown failures to the safe `INTERNAL_ERROR` response.

These instructions govern the registry but do not duplicate it. Add no
speculative or unused error codes; introduce a concrete code only with the
public behavior that requires it.

Contract tests should prove valid examples parse, invalid examples fail, and
machine values remain stable. Run focused contract tests first, then the root
verification required for completion.
