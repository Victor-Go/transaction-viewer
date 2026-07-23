# Web Workspace Instructions

Apply the root `AGENTS.md` and architecture documents before this file. Organize
business capabilities under `src/features/<feature>` and generic browser
infrastructure under `src/shared`.

## Responsibilities

### `shared/api`

Owns the generic Fetch transport, safe response parsing, HTTP and network error
normalization, and `AbortSignal` support. It preserves centrally defined public
error codes but performs no feature-specific interpretation and triggers no UI
behavior, navigation, or state changes.

### `features/<feature>/api`

Owns feature-specific endpoint calls. Use `shared/api` for transport and
`@card-platform/contracts` for public schemas and DTO types.

### `features/<feature>/model`

Owns hooks and feature-state coordination such as loading, error, retry,
filtering, and operation state. Do not duplicate backend business rules as the
final authority or branch on human-readable API messages.

### `features/<feature>/ui`

Owns user-visible React components. Consume feature model/API abstractions and
move components to `shared/ui` only after genuine reuse exists.

The Web application may depend on `@card-platform/contracts`. It must not import
backend domain, application, infrastructure, or HTTP implementation modules.

## Responsive and accessible UI

Every user-facing feature must be designed and reviewed for both narrow and wide viewports.

When implementing or changing UI:

- Start with a layout that works at narrow mobile widths, then enhance it for wider screens.
- Avoid fixed widths that cause horizontal page overflow.
- Ensure tables, forms, filters, dialogs, and action groups remain usable on small screens.
- Prefer flexible layout primitives such as grid, flexbox, minmax(), wrapping, and responsive spacing.
- Long merchant names, identifiers, amounts, and error messages must not break the layout.
- Interactive controls must remain reachable and readable without requiring horizontal page scrolling.
- Do not hide essential information or actions solely to make a narrow layout fit.
- Do not rely on hover as the only way to reveal information or actions.
- Preserve visible focus states and keyboard usability.
- Do not communicate status through color alone.
- Use semantic HTML before adding ARIA attributes.
- Shared UI abstractions should only be introduced after genuine reuse appears.

Before declaring a user-facing feature complete:

- Review it at representative narrow and wide viewport sizes.
- Add component tests for responsive behavior when it affects rendered structure or user interaction.
- Add or update Playwright viewport coverage for critical layouts or workflows where browser-level verification provides value.

## Testing

- Use React Testing Library to test accessible, user-visible behavior.
- Use `user-event` for user interaction.
- Use MSW for feature-level HTTP integration through the real shared Fetch
  transport.
- Do not mock Fetch directly when network behavior is the test subject.
- Avoid assertions about private hook state, implementation-only call counts,
  helper internals, or exact CSS class names.
- Keep unhandled MSW requests failing unless a test deliberately permits one.

Use Playwright only for critical complete journeys; keep protocol and UI
branches at the lower effective test layer. Run focused Web tests during
development, then the root verification required for completion.
