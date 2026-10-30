const { test, expect } = require('@playwright/test');

const PROJECTS = new Set(['desktop-chromium', 'android-pixel-chromium']);
test.beforeEach(async ({}, testInfo) => {
  test.skip(!PROJECTS.has(testInfo.project.name));
});

async function ready(page) {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('main').getByText(/Loading cars…/)).toHaveCount(0, { timeout: 15_000 });
}

test('listing cards show at most three specs', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const cards = page.getByRole('main').locator('article');
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) {
    const specs = card.getByLabel('Vehicle specifications').locator(':scope > div');
    const count = await specs.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);
    await expect(card.getByLabel('Vehicle specifications')).not.toContainText('—');
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
