# Transaction HTTP Contracts

`GET /api/v1/accounts/:accountId/transactions` uses cursor pagination.

- `pageSize` is the maximum number of transactions the current request allows
  the service to return. It defaults to 20 and is limited to 1 through 100. A
  single decimal query string is accepted and parsed as a number.
- `returnedCount` is the number of transactions in the current response and
  must equal `data.length`. It is not the total number of matching
  transactions.
- `totalCount` is the exact number of transactions matching the account and
  optional status/date range before applying the cursor and page size.
- `from` and `to` are optional only as a pair. They must be UTC ISO date-time
  strings and `from` must precede `to`. The server interprets the interval as
  inclusive `from` and exclusive `to`.
- `pageToken` and `nextPageToken` are opaque cursors. Clients may store and send
  them but must not depend on their contents or internal format. Tokens are
  limited to 2048 characters and are not silently normalized.
- `hasMore` indicates whether another page is available. A non-empty
  `nextPageToken` is present exactly when `hasMore` is true, and an empty page
  cannot claim that another page is available.
- `totalPages`, offsets, and page numbers are not provided.

This package defines and validates the public pagination protocol only. Cursor
generation and persistence pagination remain internal API responsibilities.

`GET /api/v1/accounts/:accountId/transactions/:transactionId` uses the shared
Account ID and Transaction ID schemas and returns `{ data: TransactionDto }`.
The Create and Reverse responses reuse the same Transaction DTO rather than
defining endpoint-specific transaction shapes.
