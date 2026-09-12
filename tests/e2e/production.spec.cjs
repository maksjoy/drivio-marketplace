const { test, expect } = require('@playwright/test');

test('home is responsive and CSP is strict', async ({ page }, testInfo) => {
  const response = await page.goto('/');
  expect(response && response.status()).toBe(200);
  await expect(page.getByRole('link', { name: /P2PCars\.ca/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Private used cars for sale in Alberta/i })).toBeVisible();
  const csp = response.headers()['content-security-policy'] || '';
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).not.toContain("'unsafe-inline'");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (testInfo.project.name === 'iphone-webkit') {
    await expect(page.getByRole('link', { name: 'Sell', exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole('link', { name: 'Sell your car', exact: true })).toBeVisible();
  }
});

test('anonymous sell flow redirects to server login', async ({ page }) => {
  await page.goto('/sell');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('listing uses canonical deep link and Share has copy fallback', async ({ page, request }) => {
  const apiResponse = await request.get('/api/listings');
  expect(apiResponse.ok()).toBeTruthy();
  const payload = await apiResponse.json();
  expect(Array.isArray(payload.listings)).toBeTruthy();
  expect(payload.listings.length).toBeGreaterThan(0);
  const id = payload.listings[0].id;
  expect(id).toMatch(/^[0-9a-f-]{36}$/i);

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (text) => { window.__p2pCopied = text; } },
      configurable: true,
    });
  });

  await page.goto(`/listings/${id}`);
  await expect(page).toHaveURL(new RegExp(`/listings/${id}$`));
  const share = page.getByRole('button', { name: 'Share' });
  await expect(share).toBeVisible();
  await share.click();
  await expect.poll(() => page.evaluate(() => window.__p2pCopied || '')).toContain(`/listings/${id}`);

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
