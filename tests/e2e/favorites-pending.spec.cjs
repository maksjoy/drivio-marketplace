const { test, expect } = require('@playwright/test');

// A signed-in user reaching the catalog by client-side navigation (the logo) must never see a saved
// car's heart as "not saved" first: cards render before /api/favorites answers, so until it does
// the heart is neutral and pending (no glyph, disabled, aria-busy, no aria-pressed), same size.
// /api/favorites is mocked and held on a promise; nothing reaches Supabase.
const PROJECTS = new Set(['desktop-chromium', 'android-pixel-chromium']);
test.beforeEach(({}, testInfo) => test.skip(!PROJECTS.has(testInfo.project.name), 'Chromium desktop + mobile only'));

async function holdFavorites(page, respond) {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const requested = [];
  await page.route('**/api/favorites*', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') return route.fulfill({ status: 500, json: { error: 'unexpected write' } });
    const ids = (new URL(request.url()).searchParams.get('listingIds') || '').split(',').filter(Boolean);
    requested.push(ids);
    await gate;
    await route.fulfill(respond(ids)).catch(() => {});
  });
  // Every accessible name each card heart ever had, in order, keyed by the card's listing link.
  await page.addInitScript(() => {
    window.__heartNames = {};
    const record = () => {
      for (const article of document.querySelectorAll('main article')) {
        const href = article.querySelector('a[href^="/listings/"]')?.getAttribute('href');
        const heart = article.querySelector('button[aria-label]');
        if (!href || !heart) continue;
        const name = `${heart.getAttribute('aria-label')}|${heart.getAttribute('aria-pressed')}`;
        const seen = (window.__heartNames[href] ||= []);
        if (seen[seen.length - 1] !== name) seen.push(name);
      }
    };
    new MutationObserver(record).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label', 'aria-pressed'] });
  });
  return { requested, release: () => release() };
}

async function viaLogo(page) {
  await page.goto('/login');
  await page.evaluate(() => { window.__sameDocument = true; });
  await page.getByRole('link', { name: 'Alberta-Cars home' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('client-side nav home: a saved car never shows an empty heart before favorites load', async ({ page }) => {
  const api = await holdFavorites(page, (ids) => ({ json: { signedIn: true, favoriteIds: ids.slice(0, 1) } }));
  await viaLogo(page);
  const card = page.getByRole('main').locator('article').first();
  const pendingHeart = card.getByRole('button', { name: 'Loading favorite status' });
  await expect(pendingHeart).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => api.requested.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__sameDocument)).toBe(true);

  // Held: neutral and pending, nothing definitive, on every card.
  await expect(pendingHeart).toBeDisabled();
  await expect(pendingHeart).toHaveAttribute('aria-busy', 'true');
  expect(await pendingHeart.getAttribute('aria-pressed')).toBeNull();
  await expect(pendingHeart.locator('span')).toHaveClass(/\binvisible\b/);
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: /^(Add to|Remove from) favorites$/ })).toHaveCount(0);
  const before = await pendingHeart.boundingBox();

  api.release();
  const saved = card.getByRole('button', { name: 'Remove from favorites' });
  await expect(saved).toHaveAttribute('aria-pressed', 'true');
  await expect(saved).toBeEnabled();
  await expect(saved.locator('span')).toHaveText('♥');
  await expect(main.locator('article').nth(1).getByRole('button', { name: 'Add to favorites' })).toHaveAttribute('aria-pressed', 'false');
  const after = await saved.boundingBox();
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);

  const firstHref = await card.locator('a[href^="/listings/"]').first().getAttribute('href');
  const history = await page.evaluate((href) => window.__heartNames[href], firstHref);
  expect(history).toEqual(['Loading favorite status|null', 'Remove from favorites|true']);
});

test('if favorites fail to load, hearts stop pending and fall back to "not saved"', async ({ page }) => {
  const api = await holdFavorites(page, () => ({ status: 500, json: { error: 'down' } }));
  await viaLogo(page);
  const card = page.getByRole('main').locator('article').first();
  await expect(card.getByRole('button', { name: 'Loading favorite status' })).toBeVisible({ timeout: 15_000 });
  api.release();
  const heart = card.getByRole('button', { name: 'Add to favorites' });
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await expect(heart).toBeEnabled();
  await expect(heart).toHaveAttribute('aria-busy', 'false');
});
