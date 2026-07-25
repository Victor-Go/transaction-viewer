import { expect, test, type Page, type Route } from '@playwright/test';

type Status = 'pending' | 'posted' | 'reversed';

const transaction = (id: string, status: Status) => ({
  id,
  accountId: 'acc_demo',
  merchantName:
    id === 'txn-created'
      ? 'Harbour Market'
      : id === 'txn-002'
        ? 'Second Merchant'
        : 'Northern Grocer',
  amount: { minorUnits: id === 'txn-created' ? 4217 : 2599, currency: 'CAD' },
  status,
  transactionDate: '2026-07-20T18:30:00.000Z',
  createdAt: '2026-07-20T18:30:00.000Z',
  updatedAt:
    status === 'reversed'
      ? '2026-07-21T18:30:00.000Z'
      : '2026-07-20T18:30:00.000Z',
  reversedAt: status === 'reversed' ? '2026-07-21T18:30:00.000Z' : null,
  canReverse: status === 'posted',
  reverseExpiresAt: '2099-08-20T18:30:00.000Z',
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const installTransactionApi = async (page: Page) => {
  let createdStatus: Status = 'pending';
  let createdReads = 0;
  const listRequests: URL[] = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (
      request.method() === 'POST' &&
      path === '/api/v1/accounts/acc_demo/transactions'
    ) {
      return json(route, { data: transaction('txn-created', 'pending') }, 201);
    }

    if (request.method() === 'POST' && path.endsWith('/txn-created/reversal')) {
      createdStatus = 'reversed';
      return json(route, {
        data: transaction('txn-created', 'reversed'),
      });
    }

    if (request.method() === 'POST' && path.endsWith('/txn-001/reversal')) {
      return json(route, { data: transaction('txn-001', 'reversed') });
    }

    if (path.endsWith('/transactions/txn-created')) {
      createdReads += 1;
      if (createdReads > 2 && createdStatus === 'pending') {
        createdStatus = 'posted';
      }
      return json(route, {
        data: transaction('txn-created', createdStatus),
      });
    }

    if (path.endsWith('/transactions/txn-001')) {
      return json(route, { data: transaction('txn-001', 'posted') });
    }

    if (path.endsWith('/transactions/txn-002')) {
      return json(route, { data: transaction('txn-002', 'posted') });
    }

    if (path.endsWith('/transactions')) {
      listRequests.push(url);
      const cursor = url.searchParams.get('pageToken');
      const status = url.searchParams.get('status');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const transactionInstant = Date.parse(
        transaction('txn-001', 'posted').transactionDate,
      );
      const matchesDate =
        from === null ||
        to === null ||
        (transactionInstant >= Date.parse(from) &&
          transactionInstant < Date.parse(to));
      if (cursor) {
        return json(route, {
          data: [transaction('txn-002', 'posted')],
          meta: {
            pageSize: 20,
            returnedCount: 1,
            totalCount: 2,
            hasMore: false,
            nextPageToken: null,
          },
        });
      }
      const matches = status !== 'pending' && matchesDate;
      return json(route, {
        data: matches ? [transaction('txn-001', 'posted')] : [],
        meta: {
          pageSize: 20,
          returnedCount: matches ? 1 : 0,
          totalCount: matches ? 2 : 0,
          hasMore: matches,
          nextPageToken: matches ? 'opaque/+== e2e-cursor' : null,
        },
      });
    }

    return json(
      route,
      { error: { code: 'TRANSACTION_NOT_FOUND', message: 'Not found.' } },
      404,
    );
  });

  return { listRequests };
};

test('desktop purchase lifecycle: filter, paginate, create, post, and reverse', async ({
  page,
}) => {
  await page.clock.install();
  await installTransactionApi(page);
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Transaction history' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Posted' }).click();
  await expect(page).toHaveURL(/status=posted/);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByText('Second Merchant')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'View details for Northern Grocer' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Create transaction' }).click();
  await page
    .getByRole('textbox', { name: 'Merchant name' })
    .fill('Harbour Market');
  await page.getByRole('textbox', { name: 'Amount (CAD)' }).fill('42.17');
  await page.getByRole('button', { name: 'Create purchase' }).click();

  await expect(
    page.getByRole('dialog', { name: 'Transaction details' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('dialog', { name: 'Transaction details' })
      .getByText(/New transactions begin as Pending/),
  ).toBeVisible();

  await page.clock.fastForward(2000);
  await expect(
    page.getByRole('button', { name: 'Reverse transaction' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Reverse transaction' }).click();
  await expect(
    page.getByRole('alertdialog', { name: 'Reverse this transaction?' }),
  ).toBeVisible();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Reverse transaction' })
    .click();

  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(
    page.getByRole('dialog', { name: 'Transaction details' }),
  ).toContainText('Reversed');
});

test('mobile Bottom Sheet closes from backdrop and nests confirmation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTransactionApi(page);
  await page.goto('/accounts/acc_demo/transactions');
  const trigger = page.getByRole('button', {
    name: 'View details for Northern Grocer',
  });
  await trigger.click();

  const detail = page.getByRole('dialog', { name: 'Transaction details' });
  await expect(detail).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Close details' }),
  ).toBeVisible();
  const panelBox = await detail.boundingBox();
  expect(panelBox?.y).toBeGreaterThan(100);

  await page
    .locator('#overlay-root > div[data-state="open"]')
    .first()
    .click({ position: { x: 4, y: 4 } });
  await expect(detail).toHaveCount(0);

  await trigger.click();
  await page.getByRole('button', { name: 'Reverse transaction' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(detail).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).click();
  await expect(detail).toHaveCount(0);
});

test('direct Detail route restores History and closes to its parent URL', async ({
  page,
}) => {
  await installTransactionApi(page);
  await page.goto('/accounts/acc_demo/transactions/txn-001');

  await expect(
    page.getByRole('dialog', { name: 'Transaction details' }),
  ).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Transaction history');
  await page.getByRole('button', { name: 'Close details' }).click();
  await expect(page).toHaveURL('/accounts/acc_demo/transactions');
});

test('keyboard opening enters the overlay and closing restores the trigger', async ({
  page,
}) => {
  await installTransactionApi(page);
  await page.goto('/accounts/acc_demo/transactions');
  const trigger = page.getByRole('button', {
    name: 'View details for Northern Grocer',
  });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const close = page.getByRole('button', { name: 'Close details' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('dialog').locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('desktop Search by Date applies, paginates, edits, and clears explicitly', async ({
  page,
}) => {
  const api = await installTransactionApi(page);
  await page.goto('/accounts/acc_demo/transactions?status=posted');
  await expect(page.getByText('Northern Grocer')).toBeVisible();
  const initialRequestCount = api.listRequests.length;

  await page.getByRole('button', { name: 'Search by date' }).click();
  let dateDialog = page.getByRole('dialog', {
    name: 'Search transactions by date',
  });
  await expect(dateDialog).toBeVisible();
  await expect(dateDialog.getByRole('spinbutton')).toHaveCount(0);
  await expect(dateDialog.getByText('Select a start date')).toBeVisible();
  await expect(dateDialog.getByText('Select an end date')).toBeVisible();
  await dateDialog.getByRole('button', { name: 'Previous month' }).click();
  await dateDialog.getByRole('button', { name: 'Previous year' }).click();
  await dateDialog.getByRole('button', { name: 'Next year' }).click();
  await dateDialog.getByRole('button', { name: 'Next month' }).click();
  expect(api.listRequests).toHaveLength(initialRequestCount);
  await page.locator('[data-date="2026-07-20"]').click();
  await expect(dateDialog.getByText('July 20, 2026')).toBeVisible();
  await expect(page.locator('[data-date="2026-07-20"]')).toHaveAttribute(
    'data-selection-start',
  );
  await page
    .locator('#overlay-root > div[data-state="open"]')
    .first()
    .click({ position: { x: 4, y: 4 } });
  await expect(dateDialog).toHaveCount(0);
  expect(api.listRequests).toHaveLength(initialRequestCount);

  await page.getByRole('button', { name: 'Search by date' }).click();
  dateDialog = page.getByRole('dialog', {
    name: 'Search transactions by date',
  });
  await expect(dateDialog.locator('[data-selected]')).toHaveCount(0);
  await page.locator('[data-date="2026-07-20"]').click();
  await page.locator('[data-date="2026-07-21"]').click();
  expect(api.listRequests).toHaveLength(initialRequestCount);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/status=posted/);
  await expect(page).toHaveURL(/fromDate=2026-07-20/);
  await expect(page).toHaveURL(/toDate=2026-07-21/);
  expect(api.listRequests).toHaveLength(initialRequestCount + 1);
  await expect(
    page.getByRole('button', {
      name: 'Edit date search: Jul 20–21',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByText('Second Merchant')).toBeVisible();
  expect(api.listRequests.at(-1)?.searchParams.get('pageToken')).toBe(
    'opaque/+== e2e-cursor',
  );

  await page
    .getByRole('button', { name: 'Edit date search: Jul 20–21' })
    .click();
  await expect(page.locator('[data-date="2026-07-20"]')).toHaveAttribute(
    'data-selection-start',
  );
  await page.locator('[data-date="2026-07-22"]').click();
  await expect(dateDialog.getByText('July 22, 2026')).toBeVisible();
  await expect(dateDialog.getByText('Select an end date')).toBeVisible();
  await expect(
    dateDialog.getByRole('button', { name: 'Search', exact: true }),
  ).toBeDisabled();
  await page.locator('[data-date="2026-07-23"]').click();
  await expect(
    dateDialog.getByRole('button', { name: 'Search', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page
    .getByRole('button', { name: 'Clear date search: Jul 20–21' })
    .click();
  await expect(page).not.toHaveURL(/fromDate/);
  await expect(page).not.toHaveURL(/toDate/);
  await expect(page).toHaveURL(/status=posted/);
  await expect
    .poll(() => api.listRequests.at(-1)?.searchParams.get('from'))
    .toBeNull();
  expect(api.listRequests.at(-1)?.searchParams.get('pageToken')).toBeNull();
  expect(api.listRequests.at(-1)?.searchParams.get('from')).toBeNull();
});

test('mobile Search by Date uses six stable weeks and selectable adjacent dates', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installTransactionApi(page);
  await page.goto('/accounts/acc_demo/transactions');

  await page.getByRole('button', { name: 'Search by date' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Search transactions by date',
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('gridcell')).toHaveCount(42);
  await expect(
    dialog.getByRole('heading', { name: 'July 2026' }),
  ).toBeVisible();
  const initialHeight = await dialog
    .getByRole('grid')
    .evaluate((element) => element.getBoundingClientRect().height);
  await dialog.locator('[data-date="2026-06-30"]').click();
  await expect(
    dialog.getByRole('heading', { name: 'July 2026' }),
  ).toBeVisible();
  await dialog.locator('[data-date="2026-07-02"]').click();
  await expect(dialog.locator('[data-date="2026-07-01"]')).toHaveAttribute(
    'data-range-middle',
  );
  await expect(dialog.getByRole('gridcell')).toHaveCount(42);
  const selectedHeight = await dialog
    .getByRole('grid')
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(selectedHeight).toBeCloseTo(initialHeight, 2);
  await dialog.getByRole('button', { name: 'Search', exact: true }).click();

  await expect(page).toHaveURL(/fromDate=2026-06-30/);
  await expect(
    page.getByRole('button', {
      name: 'Edit date search: Jun 30–Jul 2',
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear date search: Jun 30–Jul 2' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Search by date' }),
  ).toBeFocused();
});

test('Search by Date keeps keyboard selection synchronized across a month boundary', async ({
  page,
}) => {
  await installTransactionApi(page);
  await page.goto('/accounts/acc_demo/transactions');
  await page.getByRole('button', { name: 'Search by date' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Search transactions by date',
  });
  const julyFirst = dialog.locator('[data-date="2026-07-01"]');
  await julyFirst.focus();

  await page.keyboard.press('ArrowLeft');
  await expect(dialog.locator('[data-date="2026-06-30"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');

  await expect(dialog.getByText('June 30, 2026')).toBeVisible();
  await expect(dialog.getByText('July 2, 2026')).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: 'July 2026' }),
  ).toBeVisible();
});

test('French Search by Date localizes calendar, range, and empty state', async ({
  page,
}) => {
  await installTransactionApi(page);
  await page.goto('/accounts/acc_demo/transactions');
  await page.getByRole('combobox', { name: 'Language' }).click();
  await page.getByRole('option', { name: 'French' }).click();
  await expect(
    page.getByRole('heading', { name: 'Historique des transactions' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.getByRole('button', { name: 'Rechercher par date' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Rechercher des transactions par date',
  });
  await expect(
    dialog.getByRole('button', { name: 'Mois précédent' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Année précédente' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Année suivante' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /dimanche 28 juin 2026/i }),
  ).toBeVisible();
  await dialog.locator('[data-date="2026-07-21"]').click();
  await expect(dialog.getByText('21 juillet 2026')).toBeVisible();
  await expect(dialog.getByText('Sélectionnez une date de fin')).toBeVisible();
  await dialog.locator('[data-date="2026-07-22"]').click();
  await expect(dialog.getByText('22 juillet 2026')).toBeVisible();
  await dialog.getByRole('button', { name: 'Rechercher', exact: true }).click();

  await expect(
    page.getByRole('button', {
      name: 'Modifier la recherche par date : 21 – 22 juill.',
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Aucune transaction trouvée du 21 – 22 juill.'),
  ).toBeVisible();
});
