# Transaction Frontend Architecture

## Composition and dependency flow

The browser application has one React root. `BrowserRouter` and
`OverlayProvider` are composed once under that root so route content,
programmatic overlays, theme styles, API behavior, and feature callbacks share
the same React context.

Transaction dependencies flow inward:

```text
Transaction pages
  -> feature UI and model hooks
  -> Transaction API adapter
  -> shared typed Fetch transport
  -> native Fetch
```

The shared contracts package supplies public DTO types, request/response
schemas, and error codes. Web code never imports API implementation modules.

## Routing and state ownership

The History route owns the loaded list, active server-side status/date query,
pagination metadata, and provenance-specific reconciliation functions. A nested Outlet keeps
History mounted behind a route-driven Detail overlay and provides an explicit
feature-local reconciliation callback. There is no global event bus or
duplicated server cache.

Create is programmatic. After a successful response, it closes, reconciles the
Pending item, and navigates to the new Detail route. Detail fetches the
single-resource endpoint and reconciles newer status data back into History.
Create may prepend a confirmed new item and increment the matching count.
Single-resource reads update only an already loaded item and never invent a
count. Status transitions add, update, or remove an item according to the
complete active status/date query. All operations deduplicate by ID and keep immutable
transaction-date/ID ordering.

## Unified overlays

`OverlayProvider` owns one ordered stack containing controlled route overlays
and typed programmatic overlays. The public controller accepts a discriminated
union for Create, reversal confirmation, and Search by Date and returns a stable handle.
Controlled Detail registers with the same stack. Depth and topmost state flow
to every overlay. Child entries record their owning overlay; parent removal
recursively removes descendants, including when a route-owned Detail unmounts.

Radix Dialog owns modal focus, focus restoration, Escape semantics, background
inertness, and accessible names. Radix AlertDialog provides confirmation
semantics. Application code adds typed stack coordination, route close
behavior, write-time dismissibility, and presentation. It does not add
document-level keyboard handlers or a focus trap.

One `ResponsiveOverlay` panel DOM morphs through CSS: below 40rem it is a
safe-area-aware Bottom Sheet; at and above 40rem it is a centered Modal.
Viewport changes do not remount feature state. Drag and swipe behavior are
intentionally absent.

Z-index is calculated from global `--z-overlay-base`,
`--z-overlay-interval`, and per-overlay `--overlay-depth`. Motion timing is
defined only by global semantic duration/easing tokens and Radix data-state
animations. Closing entries remain mounted until the closed animation event;
environments without CSS animations use a no-animation fallback. Reduced-motion
preferences collapse visual movement without duplicating timing in JavaScript.

## Search by Date and localization

History keeps applied local `CalendarDate` values in `fromDate` and `toDate`
search parameters; without both parameters, History is date-unbounded. The
search overlay owns a separate discriminated draft: empty, Start-only, or
complete. One pure reducer handles every pointer and keyboard selection. A
second selection normalizes order, selecting Start again creates a one-day
range, and the first click after a complete range atomically starts a new
Start-only draft. Read-only localized Start and End summaries expose that
state; incomplete selection is normal, so it disables Search without an error.
Calendar selection and navigation do not request data. Explicit Search converts
the draft's local start midnight and the day after its inclusive end to UTC
instants, resets pages/cursor, and starts exactly one first-page request. Clear
removes only the date parameters and performs the same reset for one unbounded
first page. The API therefore receives a DST-safe `[from, to)` interval.

Status and date search are composable query dimensions with separate accessible
groups. The shared picker uses React DayPicker for its calendar grid and
`@internationalized/date` for application values. The selected draft and
controlled displayed month are independent. Only the localized previous/next
month and previous/next year buttons change the month, with 1970/current-month
boundaries enforced. No third-party state is mutated.

The grid uses DayPicker's public fixed-week and outside-day capabilities, so
every month contains 42 real dates. Valid adjacent-month dates remain selectable
without changing the displayed heading. A shared adapter carries calendar days
through JavaScript `Date` at local midday and converts them back from local
year/month/day fields, avoiding UTC and DST day shifts. Public range-start,
range-middle, range-end, outside, disabled, focus, and today modifiers drive a
two-layer SCSS model: the cell layer joins range interiors while the button
layer owns circular hover, focus, and rounded endpoints.

The compact applied range uses `Intl.DateTimeFormat.formatRange`: current-year
ranges omit the year, same historical-year ranges show it once, and cross-year
ranges show both years. Dialog outside and Escape dismissal flow only through
Radix `onOpenChange`; the backdrop does not invoke application close callbacks.
Removing editable date fields also removed the now-unused React Aria direct
dependencies.

i18next and its browser language detector normalize regional English/French
locales, prefer a saved selection, and fall back to English. Resource keys are
symmetric. UI language selects `en-CA` or `fr-CA` for CAD, timestamps, dates,
and counts; API enum and date values are never translated or locale-formatted.

## Styling and themes

Plain CSS owns the Tailwind entry, reset, system-driven semantic light/dark
themes, and global color, z-index, radius, and motion tokens. Tailwind handles
straightforward layout and typography. SCSS Modules handle glass surfaces,
complex local state, and overlay animation/presentation. Components consume
semantic tokens; opaque solid fallbacks preserve readability when backdrop
blur is unavailable.

## Financial writes

CAD input remains a string until an exact decimal parser converts it to a
positive safe integer number of minor units. The parser accepts either period
or comma as a single decimal separator and rejects exponent notation,
ambiguous input, excess precision, zero, negatives, and unsafe results.

Create and Reverse generate `crypto.randomUUID()` Idempotency-Key values on the
first semantic attempt. Keys live only in component memory. Network failures
and HTTP 5xx outcomes retain the key because the commit result is uncertain.
Successful or explicit rejected outcomes clear it, and changed Create input
starts a new semantic intent. Keys and financial payloads are never logged.

Reversal eligibility fails closed:

```text
server canReverse
AND reverseExpiresAt parses
AND local clock <= reverseExpiresAt
```

The UI updates its local clock while an eligible Posted detail is open, but the
backend revalidates every command. No optimistic reversal is shown.

## Pending demonstration and production evolution

Only an open Pending Detail polls. It uses a recursive two-second timeout,
never overlaps requests, aborts on cleanup where the runtime supports the
signal, pauses while the document is hidden, resumes when visible, and stops
after Posted or Reversed.

The five-second backend transition and two-second UI polling make an
asynchronous change visible during a short take-home review. They do not model
payment-network timing or the preferred production architecture. A production
system would normally coordinate event-driven refresh through server push,
durable messaging, background synchronization, or another notification
mechanism.
