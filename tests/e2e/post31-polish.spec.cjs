const { test, expect } = require('@playwright/test');

const PROJECTS = new Set(['desktop-chromium', 'android-pixel-chromium']);
test.beforeEach(async ({}, testInfo) => {
  test.skip(!PROJECTS.has(testInfo.project.name));
});

async function ready(page) {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('main').getByText(/Loading cars…/)).toHaveCount(0, { timeout: 15_000 });
}

const SPEC_LINE = '[data-card-specs]';

async function expectSpecLine(card, expected) {
  const line = card.locator(SPEC_LINE);
  await expect(line).toHaveText(expected.join(' · '));
  // Separators are decorative: hidden from assistive tech, one fewer than the values.
  const separators = line.locator('span[aria-hidden="true"]');
  await expect(separators).toHaveCount(expected.length - 1);
  for (const separator of await separators.all()) await expect(separator).toHaveText(/^\s*·\s*$/);
  // No icon chips in the spec line any more.
  await expect(line.locator('svg')).toHaveCount(0);
}

test('listing cards show one spec line in the approved order (mileage · transmission · drivetrain)', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const cards = page.getByRole('main').locator('article');
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) {
    const text = (await card.locator(SPEC_LINE).innerText()).trim();
    const values = text.split(' · ');
    expect(values.length).toBeGreaterThan(0);
    expect(values.length).toBeLessThanOrEqual(3);
    expect(values[0]).toMatch(/^[\d,]+ km$/);
    expect(text).not.toContain('—');
  }
  await expect(cards.locator('[aria-label="Vehicle specifications"]')).toHaveCount(0);
});

test('spec line fallbacks and the Electric case (mocked catalog)', async ({ page, request }) => {
  const real = await (await request.get('/api/catalog')).json();
  const template = real.listings[0];
  const make = (id, overrides) => ({ ...template, id, images: [], imageCount: 0, features: [], ...overrides });
  const listings = [
    make('00000000-0000-4000-8000-000000000001', { mileage: 189000, transmission: 'Automatic', drivetrain: 'AWD', fuel: 'Gasoline', engine: '3.6' }),
    make('00000000-0000-4000-8000-000000000002', { mileage: 42000, transmission: 'Automatic', drivetrain: 'AWD', fuel: 'Electric', engine: null }),
    make('00000000-0000-4000-8000-000000000003', { mileage: 15000, transmission: null, drivetrain: null, fuel: 'Electric', engine: null }),
    make('00000000-0000-4000-8000-000000000004', { mileage: 98000, transmission: 'Manual', drivetrain: null, fuel: 'Diesel', engine: '2.0' }),
    make('00000000-0000-4000-8000-000000000005', { mileage: 120500, transmission: 'CVT', drivetrain: null, fuel: null, engine: '2.5 L' }),
  ];
  await page.route('**/api/catalog*', (route) => route.fulfill({ json: { ...real, listings, hasMore: false, nextCursor: null, estimatedCount: listings.length } }));
  await page.goto('/');
  await ready(page);
  const cards = page.getByRole('main').locator('article');
  await expect(cards).toHaveCount(listings.length);
  await expectSpecLine(cards.nth(0), ['189,000 km', 'Automatic', 'AWD']);
  await expectSpecLine(cards.nth(1), ['42,000 km', 'Electric', 'AWD']);
  await expectSpecLine(cards.nth(2), ['15,000 km', 'Electric']);
  await expectSpecLine(cards.nth(3), ['98,000 km', 'Manual', 'Diesel']);
  await expectSpecLine(cards.nth(4), ['120,500 km', 'CVT', '2.5 L']);
});

test('home sort menu and Show more cars use the thin line-strong border', async ({ page, request }) => {
  const real = await (await request.get('/api/catalog')).json();
  await page.route('**/api/catalog*', (route) => route.fulfill({ json: { ...real, hasMore: true, nextCursor: 'x' } }));
  await page.goto('/');
  await ready(page);
  const sort = page.getByRole('combobox', { name: 'Sort listings' });
  const more = page.getByRole('button', { name: 'Show more cars' });
  for (const control of [sort, more]) {
    await expect(control).toHaveClass(/(^|\s)border(\s|$)/);
    await expect(control).toHaveClass(/border-line-strong/);
    await expect(control).not.toHaveClass(/border-2/);
    await expect(control).toHaveCSS('border-top-width', '1px');
  }
});

test('manifest id is same-origin', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.id).toBe('/');
});

test('filter links with other casing are canonicalised in the browser; the API stays strict', async ({ page, request }) => {
  expect((await request.get('/api/catalog?transmission=cvt')).status()).toBe(400);
  expect((await request.get('/api/catalog?features=bogus')).status()).toBe(400);
  const cases = [
    ['/?transmission=cvt', /\/\?transmission=CVT$/],
    ['/?transmission=automatic&bodyType=suv', /\/\?transmission=Automatic&bodyType=SUV$/],
    ['/?features=Heated_Seats,bogus', /\/\?features=heated_seats$/],
    ['/?drivetrain=awd,4wd&sort=PRICE_ASC', /\/\?drivetrain=AWD%2C4WD&sort=price_asc$/],
  ];
  for (const [url, expected] of cases) {
    const apiCalls = [];
    page.on('request', (req) => { if (req.url().includes('/api/catalog')) apiCalls.push(req.url()); });
    await page.goto(url);
    await ready(page);
    await expect(page, url).toHaveURL(expected);
    await expect(page.getByText('Could not load listings'), url).toHaveCount(0);
    await expect(page.getByText('Invalid search filters'), url).toHaveCount(0);
    for (const call of apiCalls) expect(call, url).not.toMatch(/=cvt|=automatic|=suv|Heated_Seats|bogus|=awd|PRICE_ASC/);
    page.removeAllListeners('request');
  }
});
