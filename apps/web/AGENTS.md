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

Use this dependency direction:

```text
pages -> feature UI/model -> feature API -> shared/api -> native Fetch
```

`@card-platform/contracts` is the DTO, request, response, runtime-schema, and
public-error source of truth. Do not duplicate server DTOs, add a server-state
global store, or log account IDs, transaction IDs, merchant data, amounts,
payloads, cursors, or Idempotency-Key values.

## Transactions and overlays

- Every customer-visible string must use the localization resources. Supported
  UI languages are English and French; transport enum values remain unchanged,
  and display formatting uses `en-CA` and `fr-CA`.
- Use the shared `Input`, `CurrencyInput`, and Radix-based `Select` controls.
  Do not introduce feature-local alternatives.
- Represent money as integer minor units. Parse decimal input as text without
  floating-point arithmetic.
- Generate write Idempotency-Key values in the frontend, retain them in memory
  only, and reuse them only when the outcome is uncertain.
- Keep Transaction Detail route-driven. Create and Reverse are programmatic
  overlays and must not add routes.
- Keep exactly one React root, one `OverlayProvider`, and one logical overlay
  stack. Do not add global Modal singletons, event buses, or duplicate provider
  trees.
- Programmatic overlays opened by another overlay must declare their owner.
  Removing a parent removes every descendant. Closing remains mounted through
  the Radix closed-state animation and removes on the animation event.
- Use only Radix Dialog and AlertDialog primitives for modal semantics, focus,
  Escape behavior, and screen-reader wiring. Do not implement a focus trap.
- Mobile Bottom Sheet and centered Modal are CSS presentations of the same DOM.
  Do not branch on user agents, viewport JavaScript, or gesture dismissal.
- Transaction History is date-unbounded by default. Search by Date keeps an
  empty or applied draft inside the overlay and must not request data from
  calendar `onChange`; only explicit Search writes `fromDate`/`toDate`.
- Never mutate third-party component state. One pure reducer owns every pointer
  and keyboard range transition; a complete range restarts on the next valid
  date. Start and End are read-only summaries, and an incomplete range disables
  Search without showing an error.
- Selected range and displayed month are independent. Date selection never
  changes the displayed month; only the month/year step controls may do so.
- Status and applied date range are independent URL-backed query dimensions.
  Changing or clearing either resets pages and cursors, and client mutation
  reconciliation must evaluate the complete active query.
- Shared UI must not import feature modules. Calendar months render six real
  weeks; valid adjacent-month dates stay visible, keyboard reachable, and
  selectable without changing the displayed month. Remove direct dependencies
  when their last repository import is removed.
- Status controls and date-search controls require separate accessible
  semantics. Every visible string and accessible name requires matching
  English and French resources.

## Styling

- Plain global CSS owns the Tailwind entry, reset, semantic tokens, system
  light/dark themes, z-index scale, and motion timing.
- Tailwind owns layout, spacing, sizing, alignment, simple typography, and
  visibility. SCSS Modules own complex local states, glass surfaces,
  pseudo-elements, Radix animations, and the responsive overlay morph.
- CSS Modules use component-local concise semantic names (`root`, `header`,
  `body`, `actions`). Use modifiers or full BEM only when structural complexity
  requires them.
- Consume centralized color, z-index, and motion variables. Do not add numeric
  z-index values, inline colors, duplicated palettes, or JavaScript animation
  timeouts.
- Themes follow `prefers-color-scheme`; do not add a manual theme store.

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
- Add the focused failing test before changing observable behavior, confirm the
  intended failure, and rerun it after the minimum implementation.

Use Playwright only for critical complete journeys; keep protocol and UI
branches at the lower effective test layer. Run focused Web tests during
development, then the root verification required for completion.
