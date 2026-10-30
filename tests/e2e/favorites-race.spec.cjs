const { test, expect } = require('@playwright/test');

// The heart only flips after /api/favorites confirms the write (no optimistic flip a reload could
// "undo"), stays disabled/aria-busy meanwhile, and sends the write with keepalive.
// Every /api/favorites call is mocked: nothing reaches Supabase.
const PROJECTS = new Set(['desktop-chromium', 'android-pixel-chromium']);
test.beforeEach(({}, testInfo) => test.skip(!PROJECTS.has(testInfo.project.name), 'Chromium desktop + mobile only'));

async function signedInCatalog(page) {
  const writes = [];
  let respond = () => ({ status: 200, json: { ok: true } });
  let gate = Promise.resolve();
  await page.addInitScript(() => {
    const original = window.fetch;
    window.__favoriteWrites = [];
    window.fetch = (input, init) => {
      if (String(input).includes('/api/favorites') && init?.method && init.method !== 'GET') window.__favoriteWrites.push({ method: init.method, keepalive: Boolean(init.keepalive) });
      return original(input, init);
    };
  });
  await page.route('**/api/favorites*', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      const ids = (new URL(request.url()).searchParams.get('listingIds') || '').split(',').filter(Boolean);
      return route.fulfill({ json: { signedIn: true, favoriteIds: ids } });
    }
    writes.push({ method: request.method(), body: request.postDataJSON() });
    await gate;
    const { status, json } = respond();
    return route.fulfill({ status, json });
  });
  await page.goto('/');
  await expect(page.getByRole('main').getByText(/Loading cars…/)).toHaveCount(0, { timeout: 15_000 });
  return {
    writes,
    hold() { let release; gate = new Promise((resolve) => { release = resolve; }); return () => release(); },
    failWith(status) { respond = () => ({ status, json: { error: 'nope' } }); },
  };
}

test('unfavorite: the heart flips only after the DELETE succeeds', async ({ page }) => {
  const api = await signedInCatalog(page);
  const card = page.getByRole('main').locator('article').first();
  // Favorites load after the cards render; the heart must follow that.
  const heart = card.getByRole('button', { name: 'Remove from favorites' });
  await expect(heart).toHaveAttribute('aria-pressed', 'true');

  const release = api.hold();
  await heart.click();
  await expect.poll(() => api.writes.length).toBe(1);
  expect(api.writes[0].method).toBe('DELETE');
  // In flight: still the confirmed state, busy and not clickable again.
  const pendingHeart = card.locator('button[aria-pressed]');
  await expect(pendingHeart).toHaveAttribute('aria-pressed', 'true');
  await expect(pendingHeart).toHaveAttribute('aria-busy', 'true');
  await expect(pendingHeart).toBeDisabled();
  release();
  await expect(card.getByRole('button', { name: 'Add to favorites' })).toHaveAttribute('aria-pressed', 'false');
  await expect(card.getByRole('button', { name: 'Add to favorites' })).toHaveAttribute('aria-busy', 'false');
  expect(api.writes).toHaveLength(1);
  expect(await page.evaluate(() => window.__favoriteWrites)).toEqual([{ method: 'DELETE', keepalive: true }]);
});

test('a failed DELETE leaves the car favorited', async ({ page }) => {
  const api = await signedInCatalog(page);
  const card = page.getByRole('main').locator('article').first();
  await expect(card.getByRole('button', { name: 'Remove from favorites' })).toBeVisible();
  api.failWith(500);
  await card.getByRole('button', { name: 'Remove from favorites' }).click();
  await expect.poll(() => api.writes.length).toBe(1);
  await expect(card.locator('button[aria-pressed]')).toHaveAttribute('aria-busy', 'false');
  await expect(card.getByRole('button', { name: 'Remove from favorites' })).toHaveAttribute('aria-pressed', 'true');
});
