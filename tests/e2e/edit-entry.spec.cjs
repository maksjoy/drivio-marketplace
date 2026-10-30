const { test, expect } = require('@playwright/test');

// The way into the owner's edit form: /account "Edit" links, the listing page's Manage listing
// link, and a client redirect from the old #edit hash. Session-backed pages are covered by the
// /e2e-harness/* stand-ins (E2E_FORM_HARNESS=1). The guest redirect hits the real edit route.
const CHROMIUM = new Set(['desktop-chromium', 'android-pixel-chromium', 'android-small-chromium']);
const HARNESS_LISTING_ID = '00000000-0000-4000-8000-0000000000e2';

async function openHarness(page, url) {
  const response = await page.goto(url);
  if (response && response.status() === 404) {
    if (process.env.CI) throw new Error('E2E_FORM_HARNESS=1 is not set for the e2e server.');
    test.skip(true, 'Start the server with E2E_FORM_HARNESS=1 to run the harness tests.');
  }
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => (route.request().method() === 'GET' ? route.fallback() : route.fulfill({ status: 500, json: { error: 'writes are not allowed in this test' } })));
});

test('/account rows link each unsold listing to its edit page @key', async ({ page }) => {
  await openHarness(page, '/e2e-harness/account');
  const civic = page.getByRole('link', { name: 'Edit 2017 Honda Civic', exact: true });
  await expect(civic).toHaveAttribute('href', '/listings/00000000-0000-4000-8000-0000000000a1/edit');
  await expect(civic).toHaveText('Edit');
  await expect(page.getByRole('link', { name: 'Edit 2019 Toyota RAV4', exact: true })).toHaveAttribute('href', '/listings/00000000-0000-4000-8000-0000000000a2/edit');
  // Sold listings can't be edited, so they get no Edit link (Delete stays).
  await expect(page.getByRole('link', { name: 'Edit 2015 Ford F-150' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(3);
  // The Edit link sits next to Mark sold / Delete in the same row, all 44px tap targets 8px apart.
  const civicRow = page.locator('div.rounded-xl', { has: civic });
  const pills = [civic, civicRow.getByRole('button', { name: 'Mark sold' }), civicRow.getByRole('button', { name: 'Delete' })];
  const boxes = [];
  for (const pill of pills) {
    await expect(pill).toBeVisible();
    const box = await pill.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    boxes.push(box);
  }
  for (let index = 1; index < boxes.length; index += 1) {
    if (Math.abs(boxes[index].y - boxes[index - 1].y) < 1) expect(Math.round(boxes[index].x - (boxes[index - 1].x + boxes[index - 1].width))).toBe(8);
  }
});

test('Edit listing and Manage listing go to the edit page', async ({ page }) => {
  await openHarness(page, '/e2e-harness/edit?panel=closed');
  const edit = page.getByRole('link', { name: 'Edit listing Change price or details' });
  await expect(edit).toHaveAttribute('href', `/listings/${HARNESS_LISTING_ID}/edit`);
  expect((await edit.boundingBox()).height).toBeGreaterThanOrEqual(44);
  const manage = page.getByRole('link', { name: 'Manage listing' });
  await expect(manage).toHaveAttribute('href', `/listings/${HARNESS_LISTING_ID}/edit`);
  expect((await manage.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

test('#edit on the listing page replaces to the edit page @key', async ({ page }) => {
  await openHarness(page, '/e2e-harness/edit?panel=closed');
  await expect(page).toHaveURL(/\/e2e-harness\/edit\?panel=closed$/);
  await page.goto(`/e2e-harness/edit?panel=closed#edit`);
  // The hash is client-only. An owner is sent to the edit route; a guest then lands on sign-in.
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(`/listings/${HARNESS_LISTING_ID}/edit`)}`);
});

test('a guest opening /listings/[id]/edit is sent to sign-in with a way back @key', async ({ page }) => {
  const id = '00000000-0000-4000-8000-000000000099';
  const response = await page.goto(`/listings/${id}/edit`);
  expect(response.status()).toBeLessThan(400);
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(`/listings/${id}/edit`)}`);
  await expect(page).toHaveTitle('Sign in — Alberta-Cars');
});

test('edit page title, save bar, named fields, and no photo editor', async ({ page }) => {
  await openHarness(page, '/e2e-harness/edit');
  await expect(page).toHaveTitle('Edit listing — Alberta-Cars');
  await expect(page.getByRole('heading', { level: 1, name: 'Edit listing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Photos' })).toHaveCount(0);
  await expect(page.getByText('Saving changes sends this listing back to review.')).toBeVisible();
  const form = page.locator('form');
  await expect(form).toHaveAttribute('method', 'post');
  await expect(form).toHaveAttribute('action', `/listings/${HARNESS_LISTING_ID}/edit`);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Silver' })).toBeChecked();
  await expect(page.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', `/listings/${HARNESS_LISTING_ID}`);
  await expect(page.locator('[data-mobile-bottom-nav]')).toHaveCount(0);
  const unnamed = await page.evaluate(() => {
    return [...document.querySelectorAll('form input, form select, form textarea')]
      .filter((field) => !field.id || !field.name)
      .map((field) => field.outerHTML.slice(0, 160));
  });
  expect(unnamed).toEqual([]);
});

test('sold listings show the locked state and no form', async ({ page }) => {
  await openHarness(page, '/e2e-harness/edit?state=sold');
  const status = page.getByRole('status');
  await expect(status).toContainText("Sold listings can't be edited");
  await expect(status).toContainText('You marked this car as sold on Oct 21, 2026.');
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to my listings' })).toHaveAttribute('href', '/account');
});

test('?saved=1 shows a fixed notice to the owner and never the query text @key', async ({ page, request }) => {
  await openHarness(page, '/e2e-harness/edit?panel=closed&saved=1');
  await expect(page.getByRole('status').filter({ hasText: 'Changes saved — your listing is back in review.' })).toBeVisible();
  const body = await (await request.get('/api/catalog')).json();
  if (body.listings?.length) {
    await page.goto(`/listings/${body.listings[0].id}?saved=1`);
    await expect(page.getByText('Changes saved — your listing is back in review.')).toHaveCount(0);
  }
  const junk = '<img src=x onerror=alert(1)>';
  await openHarness(page, `/e2e-harness/edit?panel=closed&saved=${encodeURIComponent(junk)}`);
  await expect(page.getByText('Changes saved — your listing is back in review.')).toHaveCount(0);
  await expect(page.getByText(junk)).toHaveCount(0);
});

// Fields the form focuses for you (first invalid one after Save) get the 2px primary outline, not
// just the red border; a <select> too. #245886 = rgb(36, 88, 134).
const focusIndicator = (el) => { const c = getComputedStyle(el); return `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor} offset ${c.outlineOffset}`; };
for (const [url, button, field, input] of [
  ['/e2e-harness/edit', 'Save changes', '#edit-year', '1900'],
  ['/e2e-harness/sell', 'Submit for review', '#sell-make', null],
]) {
  test(`programmatic focus after submit shows a clear focus outline (${url}) @key`, async ({ page }) => {
    await openHarness(page, url);
    if (input) await page.locator(field).fill(input);
    await page.getByRole('button', { name: button }).click();
    const target = page.locator(field);
    await expect(target).toBeFocused();
    await expect(target).toHaveAttribute('aria-invalid', 'true');
    await expect.poll(() => target.evaluate(focusIndicator)).toBe('solid 2px rgb(36, 88, 134) offset 2px');
  });
}

test('edit harness and account rows are CSP-clean', async ({ page }, testInfo) => {
  test.skip(!CHROMIUM.has(testInfo.project.name));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`), true);
  });
  for (const url of ['/e2e-harness/account', '/e2e-harness/edit', '/e2e-harness/edit?state=sold']) {
    await openHarness(page, url);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__csp), url).toEqual([]);
  }
});

test('empty mileage: clicking away shows the error; pressing Save is not swallowed by it @key', async ({ page }) => {
  await openHarness(page, '/e2e-harness/sell');
  const mileage = page.locator('#sell-mileage');
  await mileage.click();
  await page.locator('#sell-year').click(); // pointer blur: error appears once the click is done
  await expect(mileage).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#sell-mileage-error')).toHaveText('Enter mileage from 0 to 2,000,000 km.');
  await expect(page.locator('#sell-year')).toBeFocused();
  await expect(page.locator('#sell-year-error')).toHaveCount(0); // never left yet, stays quiet
});
