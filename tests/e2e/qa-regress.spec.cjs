const { test, expect } = require('@playwright/test');

// QA regression round: page titles, guest sign-in links, pending catalog state, named form fields.
const PROJECTS = new Set(['desktop-chromium', 'android-pixel-chromium']);
test.beforeEach(({}, testInfo) => test.skip(!PROJECTS.has(testInfo.project.name), 'Chromium desktop + mobile only'));

const isMobile = (testInfo) => testInfo.project.name !== 'desktop-chromium';

async function ready(page) {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('main').getByText(/Loading cars…/)).toHaveCount(0, { timeout: 15_000 });
}

async function firstListing(request) {
  const body = await (await request.get('/api/catalog')).json();
  test.skip(!body.listings?.length, 'No public listings');
  return body.listings[0];
}

test('public pages use the "Page — Alberta-Cars" title', async ({ page, request }) => {
  const listing = await firstListing(request);
  const pages = [
    ['/contact', 'Contact & Support — Alberta-Cars'],
    ['/terms', 'Terms of Use — Alberta-Cars'],
    ['/privacy', 'Privacy Policy — Alberta-Cars'],
    ['/login', 'Sign in — Alberta-Cars'],
    ['/reset-password', 'Reset password — Alberta-Cars'],
  ];
  for (const [path, title] of pages) {
    await page.goto(path);
    await expect(page, path).toHaveTitle(title);
  }
  await page.goto(`/listings/${listing.id}`);
  await expect(page).toHaveTitle(new RegExp(`^${listing.year} .+ for \\$[\\d,]+ — Alberta-Cars$`));
});

test('unknown routes and listings get the 404 title', async ({ page }) => {
  for (const path of ['/no-such-page', '/listings/00000000-0000-4000-8000-000000000000']) {
    const response = await page.goto(path);
    expect(response.status(), path).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page, path).toHaveTitle(/^(Page not found|Listing not found) — Alberta-Cars$/);
  }
  await page.goto('/no-such-page');
  await expect(page).toHaveTitle('Page not found — Alberta-Cars');
});

test('signed-in-only pages send guests to /login with a way back', async ({ page }) => {
  for (const path of ['/favorites', '/messages', '/sell']) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    await expect(page).toHaveTitle('Sign in — Alberta-Cars');
  }
});

test('guest "Add to favorites" goes to /login and back to the same page', async ({ page, request }) => {
  const listing = await firstListing(request);
  await page.goto(`/listings/${listing.id}`);
  await page.getByRole('button', { name: 'Add to favorites' }).first().click();
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(`/listings/${listing.id}`)}&fav=${listing.id}`);

  await page.goto('/?sort=price_asc');
  await ready(page);
  const card = page.getByRole('main').getByRole('button', { name: 'Add to favorites' }).first();
  const id = await card.evaluate((button) => button.closest('article, li')?.querySelector('a[href^="/listings/"]')?.getAttribute('href')?.split('/').pop());
  await card.click();
  await expect(page).toHaveURL(/\/login\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('next')).toBe('/?sort=price_asc');
  if (id) expect(url.searchParams.get('fav')).toBe(id);
  else expect(url.searchParams.get('fav')).toMatch(/^[0-9a-f-]{36}$/);
});

test('sort change dims the results (aria-busy) until the delayed catalog request lands', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const results = page.getByTestId('catalog-results');
  await expect(results).toHaveAttribute('aria-busy', 'false');
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/catalog?*sort=price_desc*', async (route) => { await gate; await route.continue(); });

  await page.getByRole('combobox', { name: 'Sort listings' }).selectOption('price_desc');
  await expect(results).toHaveAttribute('aria-busy', 'true');
  await expect(results).toHaveCSS('opacity', '0.5');
  // The previous cars stay visible (dimmed) instead of a blank skeleton.
  await expect(results.locator('a[href^="/listings/"]').first()).toBeVisible();
  release();
  await expect(results).toHaveAttribute('aria-busy', 'false');
  await expect(results).toHaveCSS('opacity', '1');
});

test('removing a chip hides it at once and dims the results while loading', async ({ page }) => {
  await page.goto('/?transmission=automatic');
  await ready(page);
  const chips = page.getByRole('list', { name: 'Active filters' });
  const chip = chips.getByRole('button', { name: /automatic/i }).first();
  await expect(chip).toBeVisible();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route(/\/api\/catalog(\?(?!.*transmission=).*)?$/, async (route) => { await gate; await route.continue(); });

  await chip.click();
  await expect(chips.getByRole('button', { name: /automatic/i })).toHaveCount(0, { timeout: 1_000 });
  await expect(page.getByTestId('catalog-results')).toHaveAttribute('aria-busy', 'true');
  release();
  await expect(page.getByTestId('catalog-results')).toHaveAttribute('aria-busy', 'false');
  await expect(page).not.toHaveURL(/transmission=/);
});

test('every form field has an id or name, and the sheet does not leak copies', async ({ page }, testInfo) => {
  await page.goto('/');
  await ready(page);
  const fields = () => page.evaluate(() => {
    const all = [...document.querySelectorAll('input, select, textarea')];
    return { total: all.length, unnamed: all.filter((field) => !field.id && !field.name).map((field) => field.outerHTML.slice(0, 120)) };
  });
  const before = await fields();
  expect(before.unnamed).toEqual([]);

  const trigger = page.getByRole('region', { name: 'Vehicle search filters' }).getByRole('button', { name: /^Filters \(/ });
  const dialog = page.getByRole('dialog', { name: 'Filters' });
  let open;
  for (let round = 0; round < 3; round += 1) {
    await trigger.click();
    await expect(dialog).toBeVisible();
    const now = await fields();
    expect(now.unnamed, `open #${round + 1}`).toEqual([]);
    if (open) expect(now.total, `open #${round + 1}`).toBe(open.total);
    open = now;
    const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map((node) => node.id));
    expect(ids.length, 'ids are unique').toBe(new Set(ids).size);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
    expect((await fields()).total, `closed #${round + 1}`).toBe(before.total);
  }
  if (isMobile(testInfo)) expect(open.total).toBeGreaterThan(before.total);
});

test('credential forms POST to their own page (no GET of fields before hydration)', async ({ page, request }) => {
  for (const [path, action] of [['/login', '/login'], ['/reset-password', '/reset-password']]) {
    // The server HTML is what a pre-hydration Enter submits.
    const html = await (await request.get(path)).text();
    const tag = html.match(/<form\b[^>]*>/)?.[0] ?? '';
    expect(tag, path).toContain('method="post"');
    expect(tag, path).toContain(`action="${action}"`);
    await page.goto(path);
    const form = page.locator('form').filter({ has: page.locator('input[type="password"]') }).first();
    await expect(form).toHaveAttribute('method', 'post');
    await expect(form).toHaveAttribute('action', action);
    await expect(form.locator('input[name="password"]').first()).toBeAttached();
  }
});

test('a no-JS POST to /login or /reset-password neither errors nor echoes the fields', async ({ request }) => {
  for (const path of ['/login', '/reset-password']) {
    const response = await request.post(path, {
      form: { email: 'qa-nojs@example.invalid', password: 'NoJsSecret-123456', confirmPassword: 'NoJsSecret-123456' },
      headers: { Origin: 'http://127.0.0.1:3141' },
      maxRedirects: 0,
    });
    expect(response.status(), path).toBeLessThan(500);
    const body = await response.text();
    expect(body, path).not.toContain('NoJsSecret-123456');
    expect(body, path).not.toContain('qa-nojs@example.invalid');
    expect(response.headers().location ?? '', path).not.toContain('NoJsSecret');
  }
});
