const { test, expect } = require('@playwright/test');

// On a client-side navigation to / the catalog commits as soon as the RSC payload is in. A
// <Suspense> boundary around it made React hold that reveal (its fallback throttle, 300ms), and the
// catalog request (started on commit) waited with it. Still exactly one request per load.
// /api/catalog and /api/favorites are mocked; nothing is written.
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
  // When the RSC payload for / arrived, when the catalog shell was committed, and every catalog fetch.
  await page.addInitScript(() => {
    window.__nav = { catalogFetches: 0 };
    const original = window.fetch;
    window.fetch = (input, init) => {
      const url = String(input);
      const promise = original(input, init);
      if (url.includes('/api/catalog')) window.__nav.catalogFetches += 1;
      // Only the navigation's own RSC request, not a Link prefetch made before the click.
      if (/\/\?_rsc=/.test(url) && window.__nav.click != null) promise.then(() => { window.__nav.rsc ??= performance.now(); }, () => {});
      return promise;
    };
    document.addEventListener('click', () => { window.__nav.click ??= performance.now(); }, true);
    new MutationObserver(() => {
      if (window.__nav.shell == null && document.querySelector('#marketplace-results')) window.__nav.shell = performance.now();
    }).observe(document, { subtree: true, childList: true });
  });
  return { real, served };
}

test('logo navigation: the catalog commits right after the RSC payload, with one catalog request', async ({ page, request }) => {
  const { real, served } = await mockCatalog(page, request);
  await page.goto('/login');
  // Like a person, click once /login has settled: React also throttles a reveal that lands within
  // 300ms of /login's own Suspense fallback, which says nothing about the catalog.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__sameDocument = true; });
  await page.getByRole('link', { name: 'Alberta-Cars home' }).click();
  await expect(page).toHaveURL(/\/$/);
  const cards = page.getByRole('main').locator('article');
  await expect(cards).toHaveCount(real.listings.length, { timeout: 15_000 });
  const nav = await page.evaluate(() => ({ ...window.__nav, sameDocument: window.__sameDocument === true }));
  expect(nav.sameDocument).toBe(true);
  expect(nav.click).toBeGreaterThan(0);
  expect(nav.rsc).toBeGreaterThan(nav.click);
  // The throttle held it for at least 300ms; without the boundary it is the time to run the page chunk.
  expect(nav.shell - nav.rsc).toBeLessThan(250);
  expect(nav.catalogFetches).toBe(1);
  expect(served).toHaveLength(1);
  // #62 still holds: hearts settle once favorites are known.
  await expect(cards.first().getByRole('button', { name: 'Add to favorites' })).toHaveAttribute('aria-pressed', 'false');
});

test('hard load: exactly one catalog request', async ({ page, request }) => {
  const { real, served } = await mockCatalog(page, request);
  await page.goto('/');
  await expect(page.getByRole('main').locator('article')).toHaveCount(real.listings.length, { timeout: 15_000 });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__nav.catalogFetches)).toBe(1);
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
