const { test, expect } = require('@playwright/test');

// On a client-side navigation to / the catalog request starts while the page renders, not after
// React commits it (that commit was measured ~300ms after the RSC payload and JS had arrived), and
// it is still exactly one request. /api/catalog and /api/favorites are mocked; nothing is written.
const PROJECTS = new Set(['desktop-chromium', 'android-pixel-chromium']);
test.beforeEach(({}, testInfo) => test.skip(!PROJECTS.has(testInfo.project.name), 'Chromium desktop + mobile only'));

async function mockCatalog(page, request) {
  const real = await (await request.get('/api/catalog')).json();
  expect(real.listings.length).toBeGreaterThan(0);
  const served = [];
  await page.route('**/api/catalog*', (route) => {
    served.push(route.request().url());
    return route.fulfill({ json: { ...real, hasMore: false, nextCursor: null, estimatedCount: real.listings.length } });
  });
  await page.route('**/api/favorites*', (route) => route.fulfill({ json: { signedIn: false, favoriteIds: [] } }));
  // Every catalog fetch, and whether the catalog page had been committed to the DOM at that moment.
  await page.addInitScript(() => {
    window.__catalogFetches = [];
    const original = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).includes('/api/catalog')) {
        window.__catalogFetches.push({ url: String(input), committed: Boolean(document.querySelector('#marketplace-results')) });
      }
      return original(input, init);
    };
  });
  return { real, served };
}

test('logo navigation: the catalog request starts before the page commits, and only once', async ({ page, request }) => {
  const { real, served } = await mockCatalog(page, request);
  await page.goto('/login');
  await page.evaluate(() => { window.__sameDocument = true; });
  await page.getByRole('link', { name: 'Alberta-Cars home' }).click();
  await expect(page).toHaveURL(/\/$/);
  const cards = page.getByRole('main').locator('article');
  await expect(cards).toHaveCount(real.listings.length, { timeout: 15_000 });
  expect(await page.evaluate(() => window.__sameDocument)).toBe(true);

  const fetches = await page.evaluate(() => window.__catalogFetches);
  expect(fetches).toHaveLength(1);
  expect(fetches[0].committed).toBe(false);
  expect(served).toHaveLength(1);
  // #62 still holds: hearts settle once favorites are known.
  await expect(cards.first().getByRole('button', { name: 'Add to favorites' })).toHaveAttribute('aria-pressed', 'false');
});

test('hard load: exactly one catalog request', async ({ page, request }) => {
  const { real, served } = await mockCatalog(page, request);
  await page.goto('/');
  await expect(page.getByRole('main').locator('article')).toHaveCount(real.listings.length, { timeout: 15_000 });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__catalogFetches.length)).toBe(1);
  expect(served).toHaveLength(1);
});

test('catalog edge cache: 30s fresh, stale-while-revalidate well inside the signed thumbnail TTL', async ({ request }) => {
  const response = await request.get('/api/catalog');
  expect(response.status()).toBe(200);
  const cacheControl = response.headers()['cache-control'] || '';
  const maxAge = Number(/s-maxage=(\d+)/.exec(cacheControl)?.[1]);
  const swr = Number(/stale-while-revalidate=(\d+)/.exec(cacheControl)?.[1]);
  expect(cacheControl).toMatch(/^public\b/);
  expect(maxAge).toBe(30);
  expect(swr).toBeGreaterThanOrEqual(1800);
  // Thumbnails are signed for 3600s; the oldest copy the edge may serve must keep >= 25 min of them.
  expect(maxAge + swr).toBeLessThanOrEqual(3600 - 25 * 60);
  const body = await response.json();
  const signed = body.listings.flatMap((listing) => listing.images).find((url) => /token=/.test(url));
  if (signed) {
    const token = new URL(signed).searchParams.get('token');
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(claims.exp - claims.iat).toBe(3600);
  }
});
