# List Transactions HTTP Contract

`GET /api/v1/accounts/:accountId/transactions` uses cursor pagination.

- `pageSize` is the maximum number of transactions the current request allows
  the service to return. It defaults to 20 and is limited to 1 through 100. A
  single decimal query string is accepted and parsed as a number.
- `returnedCount` is the number of transactions in the current response and
  must equal `data.length`. It is not the total number of matching
  transactions.
- `pageToken` and `nextPageToken` are opaque cursors. Clients may store and send
  them but must not depend on their contents or internal format. Tokens are
  limited to 2048 characters and are not silently normalized.
- `hasMore` indicates whether another page is available. A non-empty
  `nextPageToken` is present exactly when `hasMore` is true, and an empty page
  cannot claim that another page is available.
- `totalCount` and `totalPages` are intentionally not provided because
  transaction data changes continuously and the current product has no total
  page-count requirement.

This package defines and validates the pagination protocol only. Repository
cursor generation and persistence pagination behavior belong to a later
infrastructure slice.
