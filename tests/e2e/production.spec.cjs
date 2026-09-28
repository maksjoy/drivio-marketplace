const { test, expect } = require('@playwright/test');

test('home is responsive and CSP is strict', async ({ page }) => {
  const response = await page.goto('/');
  expect(response && response.status()).toBe(200);
  await expect(page.getByRole('link', { name: /Alberta[- ]Cars/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Find your next car in Alberta/i })).toBeVisible();
  const csp = response.headers()['content-security-policy'] || '';
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).not.toContain("'unsafe-inline'");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const mobileSell = page.getByRole('link', { name: 'Sell', exact: true });
  if (await mobileSell.isVisible().catch(() => false)) {
    await expect(mobileSell).toBeVisible();
  } else {
    await expect(page.getByRole('link', { name: 'Sell your car', exact: true })).toBeVisible();
  }
});

test('filter changes preserve the current scroll position', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/');
  await page.getByRole('button', { name: 'Advanced filters' }).click();

  const filters = page.getByRole('region', { name: 'Vehicle search filters' });
  const bodyType = filters.getByLabel(/Body type/).first();
  await expect(bodyType).toBeVisible();
  await bodyType.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  const firstPosition = await page.evaluate(() => window.scrollY);
  expect(firstPosition).toBeGreaterThan(100);

  await bodyType.selectOption({ label: 'SUV' });
  await expect(page).toHaveURL(/bodyType=SUV/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const afterFirstChange = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterFirstChange - firstPosition)).toBeLessThanOrEqual(2);

  const drivetrain = filters.getByLabel(/Drivetrain/).first();
  const secondPosition = await page.evaluate(() => window.scrollY);
  await drivetrain.selectOption({ label: 'AWD' });
  await expect(page).toHaveURL(/drivetrain=AWD/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  const afterSecondChange = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterSecondChange - secondPosition)).toBeLessThanOrEqual(2);
});

test('anonymous sell flow redirects to server login', async ({ page }) => {
  await page.goto('/sell');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('mobile inputs do not zoom or create horizontal overflow', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('iphone'));
  await page.goto('/login');
  const email = page.getByLabel('Email');
  const fontSize = await email.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);
  await email.focus();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('listing uses canonical deep link and public catalog does not leak seller contacts', async ({ page, request }, testInfo) => {
  const apiResponse = await request.get('/api/listings');
  expect(apiResponse.ok()).toBeTruthy();
  const payload = await apiResponse.json();
  expect(Array.isArray(payload.listings)).toBeTruthy();
  expect(payload.listings.length).toBeGreaterThan(0);
  const first = payload.listings[0];
  expect(first).not.toHaveProperty('sellerPhone');
  expect(first).not.toHaveProperty('sellerEmail');
  expect(first).not.toHaveProperty('sellerName');
  const id = first.id;
  expect(id).toMatch(/^[0-9a-f-]{36}$/i);

  await page.goto(`/listings/${id}`);
  await expect(page).toHaveURL(new RegExp(`/listings/${id}$`));
  const share = page.getByRole('button', { name: 'Share' });
  await expect(share).toBeVisible();

  if (testInfo.project.name.includes('iphone') || testInfo.project.name.includes('android')) {
    const actionBar = page.locator('div.fixed.inset-x-0').first();
    const bottomNav = page.locator('[data-mobile-bottom-nav="true"]').first();
    if (await actionBar.isVisible().catch(() => false) && await bottomNav.isVisible().catch(() => false)) {
      const [actionBox, navBox] = await Promise.all([actionBar.boundingBox(), bottomNav.boundingBox()]);
      expect(actionBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(navBox.y + 1);
    }
  }

  if (testInfo.project.name === 'desktop-chromium') {
    await page.evaluate(() => {
      try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch {}
      try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch {}
      document.execCommand = () => true;
    });
    await share.click();
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
  }

  await page.goto(`/?listing=${id}`);
  await expect(page).toHaveURL(new RegExp(`/listings/${id}$`));
});

test('legal pages and 404 are served by canonical app', async ({ page }) => {
  for (const path of ['/privacy', '/terms', '/contact']) {
    const response = await page.goto(path);
    expect(response && response.status()).toBe(200);
  }
  const missing = await page.goto('/this-page-does-not-exist-p2p');
  expect(missing && missing.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
