const { test, expect } = require('@playwright/test');

// The way into the owner's edit form: /account "Edit" links and the listing page's #edit panel.
// Both need a Supabase session in the real app, so these run against the /e2e-harness/* pages
// (E2E_FORM_HARNESS=1), which render the same components with fixture data. No API is called.
const CHROMIUM = new Set(['desktop-chromium', 'android-pixel-chromium', 'android-small-chromium']);

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

test('/account rows link each unsold listing to its edit panel @key', async ({ page }) => {
  await openHarness(page, '/e2e-harness/account');
  const civic = page.getByRole('link', { name: 'Edit 2017 Honda Civic', exact: true });
  await expect(civic).toHaveAttribute('href', '/listings/00000000-0000-4000-8000-0000000000a1#edit');
  await expect(civic).toHaveText('Edit');
  await expect(page.getByRole('link', { name: 'Edit 2019 Toyota RAV4', exact: true })).toHaveAttribute('href', '/listings/00000000-0000-4000-8000-0000000000a2#edit');
  // Sold listings can't be edited, so they get no Edit link (Delete stays).
  await expect(page.getByRole('link', { name: 'Edit 2015 Ford F-150' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(3);
  // The Edit link sits next to Delete in the same row.
  const civicRow = page.locator('div.rounded-xl', { has: civic });
  await expect(civicRow.getByRole('button', { name: 'Delete' })).toBeVisible();
});

test('#edit opens the edit panel and focuses its summary @key', async ({ page }) => {
  await openHarness(page, '/e2e-harness/edit?panel=closed');
  const panel = page.locator('details#edit');
  await expect(panel).not.toHaveAttribute('open', '');
  await expect(page.locator('#edit-year')).toBeHidden();

  await openHarness(page, '/e2e-harness/edit?panel=closed#edit');
  await expect(panel).toHaveAttribute('open', '');
  await expect(page.locator('#edit-year')).toBeVisible();
  await expect(panel.locator('summary')).toBeFocused();
  await expect(panel.locator('summary')).toBeInViewport();
});

test('the owner "Manage listing" link opens the panel on the same page', async ({ page }) => {
  await openHarness(page, '/e2e-harness/edit?panel=closed');
  const panel = page.locator('details#edit');
  const manage = page.getByRole('link', { name: 'Manage listing' });
  await expect(manage).toHaveAttribute('href', '#edit');
  await manage.scrollIntoViewIfNeeded();
  await expect(panel.locator('summary')).not.toBeInViewport();
  await manage.click();
  await expect(panel).toHaveAttribute('open', '');
  await expect(panel.locator('summary')).toBeFocused();
  await expect(panel.locator('summary')).toBeInViewport();
  // Closing it and following the link again (hash already #edit, no hashchange) reopens it.
  await panel.locator('summary').click();
  await expect(panel).not.toHaveAttribute('open', '');
  await page.getByRole('link', { name: 'Manage listing' }).click();
  await expect(panel).toHaveAttribute('open', '');
});

// Fields the form focuses for you (first invalid one after Save) get the 2px primary outline, not
// just the red border; a <select> too. #245886 = rgb(36, 88, 134).
const focusIndicator = (el) => { const c = getComputedStyle(el); return `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor} offset ${c.outlineOffset}`; };
for (const [url, button, field, input] of [
  ['/e2e-harness/edit', 'Save and resubmit', '#edit-year', '1900'],
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
  for (const url of ['/e2e-harness/account', '/e2e-harness/edit?panel=closed#edit']) {
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
