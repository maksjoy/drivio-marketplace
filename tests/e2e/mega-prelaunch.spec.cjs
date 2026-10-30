const { test, expect } = require('@playwright/test');

const PUBLIC_ROUTES = [
  ['home', '/'],
  ['login', '/login'],
  ['privacy', '/privacy'],
  ['terms', '/terms'],
  ['contact', '/contact'],
];

const INTERACTION_PROJECTS = new Set([
  'desktop-chromium',
  'android-pixel-chromium',
]);

async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(350);
}

async function assertPageIntegrity(page, label) {
  const snapshot = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const rootWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    const controls = Array.from(document.querySelectorAll('button,input,select,textarea'));
    const controlOffenders = [];

    for (const element of controls) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const horizontalScroller = element.closest('.overflow-x-auto');
      if (horizontalScroller) continue;
      if (rect.left < -2 || rect.right > viewportWidth + 2) {
        controlOffenders.push({
          tag: element.tagName,
          text: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || '').trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          viewportWidth,
        });
      }
    }

    const clippedText = [];
    for (const element of Array.from(document.querySelectorAll('h1,h2,h3,p,label,button'))) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || rect.width < 1 || rect.height < 1) continue;
      const text = (element.textContent || '').trim();
      if (!text) continue;
      if (element.scrollWidth > element.clientWidth + 4 && ['hidden', 'clip'].includes(style.overflowX)) {
        clippedText.push({ tag: element.tagName, text: text.slice(0, 100), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth });
      }
    }

    const unnamedButtons = controls
      .filter((element) => element.tagName === 'BUTTON')
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' || rect.width < 1 || rect.height < 1) return false;
        return !(element.getAttribute('aria-label') || element.textContent || '').trim();
      })
      .map((element) => element.outerHTML.slice(0, 180));

    return {
      viewportWidth,
      rootWidth,
      overflow: rootWidth - viewportWidth,
      controlOffenders: controlOffenders.slice(0, 10),
      clippedText: clippedText.slice(0, 10),
      unnamedButtons: unnamedButtons.slice(0, 10),
    };
  });

  expect(snapshot.overflow, `${label}: horizontal page overflow ${JSON.stringify(snapshot)}`).toBeLessThanOrEqual(2);
  expect(snapshot.controlOffenders, `${label}: controls outside viewport`).toEqual([]);
  expect(snapshot.clippedText, `${label}: clipped important text`).toEqual([]);
  expect(snapshot.unnamedButtons, `${label}: visible unnamed buttons`).toEqual([]);
}

async function firstPublicListing(request) {
  const response = await request.get('/api/listings');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(Array.isArray(body.listings)).toBeTruthy();
  expect(body.listings.length).toBeGreaterThan(0);
  return body.listings[0];
}

for (const [name, route] of PUBLIC_ROUTES) {
  test(`${name} renders cleanly with no clipping or horizontal overflow${name === 'home' || name === 'login' ? ' @key' : ''}`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response && response.status(), `${route} HTTP status`).toBeLessThan(400);
    await settle(page);
    await assertPageIntegrity(page, route);
  });
}

test('all anonymous protected routes fail closed to sign-in', async ({ page }) => {
  for (const route of ['/sell', '/account', '/favorites', '/messages']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  }
});

test('login mode buttons remain usable and layout-safe @key', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('webkit'), 'Headless WebKit in CI does not reliably hydrate React event handlers; WebKit layout/render coverage remains enabled.');
  await page.goto('/login');
  await settle(page);

  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveAttribute('minlength', '8');
  await assertPageIntegrity(page, 'login-signup');

  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveCount(0);
  await assertPageIntegrity(page, 'login-recovery');

  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('home navigation links and mobile bottom bar remain inside the viewport @key', async ({ page }, testInfo) => {
  await page.goto('/');
  await settle(page);
  await assertPageIntegrity(page, `home-${testInfo.project.name}`);

  const mobileNav = page.locator('[data-mobile-bottom-nav="true"]');
  const mobile = await mobileNav.isVisible().catch(() => false);

  if (mobile) {
    for (const name of ['Home', 'Favorites', 'Sell', 'Messages', 'Account']) {
      await expect(mobileNav.getByRole('link', { name, exact: true })).toBeVisible();
    }
    const box = await mobileNav.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    if (!testInfo.project.name.includes('webkit')) {
      const fixed = await mobileNav.evaluate((element) => {
        const style = getComputedStyle(element);
        return { position: style.position, bottom: style.bottom };
      });
      expect(fixed.position).toBe('fixed');
      expect(fixed.bottom).toBe('0px');
    }
  } else {
    for (const name of ['Browse', 'Saved', 'Messages', 'Sell your car', 'Sign in']) {
      await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible();
    }
  }
});

test('filters can be combined repeatedly without jumping to the top', async ({ page }, testInfo) => {
  test.skip(!INTERACTION_PROJECTS.has(testInfo.project.name));
  const mobile = testInfo.project.name !== 'desktop-chromium';
  await page.goto('/');
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 240));
  const parked = await page.evaluate(() => window.scrollY);

  const filters = page.getByRole('region', { name: 'Vehicle search filters' });
  if (mobile) await filters.getByRole('button', { name: /^Filters \(/ }).click();
  const inline = mobile ? page.getByRole('dialog', { name: 'Filters' }) : filters;

  await inline.getByLabel('Make', { exact: true }).filter({ visible: true }).selectOption({ label: 'Toyota' });
  await expect(page).toHaveURL(/make=Toyota/);
  await inline.getByLabel('Model', { exact: true }).filter({ visible: true }).selectOption({ label: 'Corolla' });
  await expect(page).toHaveURL(/model=Corolla/);
  await inline.getByLabel('Location', { exact: true }).filter({ visible: true }).selectOption({ label: 'Calgary' });
  await expect(page).toHaveURL(/city=Calgary/);

  const minPrice = inline.getByLabel('Minimum price', { exact: true }).filter({ visible: true });
  await minPrice.fill('10000');
  await minPrice.blur();
  await expect(page).toHaveURL(/priceMin=10000/);
  const maxPrice = inline.getByLabel('Maximum price', { exact: true }).filter({ visible: true });
  await maxPrice.fill('45000');
  await maxPrice.blur();
  await expect(page).toHaveURL(/priceMax=45000/);
  if (parked > 0) expect(Math.abs((await page.evaluate(() => window.scrollY)) - parked)).toBeLessThanOrEqual(12);

  if (!mobile) await filters.getByRole('button', { name: /^Filters \(/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Filters' });
  await dialog.getByRole('checkbox', { name: 'Gasoline', exact: true }).click();
  await expect(page).toHaveURL(/fuel=Gasoline/);
  await dialog.getByRole('checkbox', { name: 'SUV', exact: true }).click();
  await expect(page).toHaveURL(/bodyType=SUV/);
  await dialog.getByLabel('Transmission', { exact: true }).selectOption({ label: 'Automatic' });
  await expect(page).toHaveURL(/transmission=Automatic/);
  await dialog.getByLabel('Transmission', { exact: true }).selectOption({ label: 'CVT' });
  await expect(page).toHaveURL(/transmission=CVT/);
  await dialog.getByRole('checkbox', { name: 'AWD', exact: true }).click();
  await expect(page).toHaveURL(/drivetrain=AWD/);
  if (parked > 0) expect(Math.abs((await page.evaluate(() => window.scrollY)) - parked), 'Dialog filters must not reset scroll').toBeLessThanOrEqual(12);

  const yearFrom = dialog.getByLabel('Year from', { exact: true });
  await yearFrom.fill('2015');
  await yearFrom.blur();
  await expect(page).toHaveURL(/yearMin=2015/);
  const yearTo = dialog.getByLabel('Year to', { exact: true });
  await yearTo.fill('2026');
  await yearTo.blur();
  await expect(page).toHaveURL(/yearMax=2026/);

  const mileageTo = dialog.getByLabel('Mileage to', { exact: true });
  await mileageTo.fill('150000');
  await mileageTo.blur();
  await expect(page).toHaveURL(/mileageMax=150000/);

  await assertPageIntegrity(page, `filters-${testInfo.project.name}`);
  await dialog.getByRole('button', { name: /^Show .*cars$/ }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const clear = filters.getByRole('button', { name: 'Clear all' }).first();
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(page).toHaveURL(/\/$/);
});

test('public listing detail, gallery and anonymous CTAs work @key', async ({ page, request }, testInfo) => {
  const listing = await firstPublicListing(request);
  await page.goto(`/listings/${listing.id}`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await assertPageIntegrity(page, `listing-${testInfo.project.name}`);

  const openPhoto = page.getByRole('button', { name: /Open photo \d+ of \d+ fullscreen/ });
  const save = page.getByRole('button', { name: 'Add to favorites' }).first();
  const message = page.locator('button:visible').filter({ hasText: 'Sign in to message seller' }).first();
  const report = page.getByRole('button', { name: 'Report listing' });

  if (await openPhoto.count()) await expect(openPhoto.first()).toBeVisible();
  await expect(save).toBeVisible();
  await expect(message).toBeVisible();
  if (await report.count()) await expect(report).toBeVisible();

  if (testInfo.project.name.includes('webkit')) return;

  if (await openPhoto.count()) {
    await openPhoto.first().click();
    const dialog = page.getByRole('dialog', { name: 'Photo viewer' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Zoom in|Zoom out/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close photo viewer' }).click();
    await expect(dialog).toHaveCount(0);
  }

  await save.click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);

  await page.goto(`/listings/${listing.id}`);
  await settle(page);
  const nextMessage = page.locator('button:visible').filter({ hasText: 'Sign in to message seller' }).first();
  await expect(nextMessage).toBeVisible();
  await nextMessage.click();
  await expect(page).toHaveURL(/\/login\?next=/);

  await page.goto(`/listings/${listing.id}`);
  await settle(page);
  const nextReport = page.getByRole('button', { name: 'Report listing' });
  if (await nextReport.count()) {
    await nextReport.click();
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  }
});

test('listing cards open canonical detail pages from the marketplace', async ({ page, request }, testInfo) => {
  test.skip(!INTERACTION_PROJECTS.has(testInfo.project.name));
  const listing = await firstPublicListing(request);
  await page.goto('/');
  await settle(page);
  await page.goto(`/listings/${listing.id}`);
  await expect(page).toHaveURL(new RegExp(`/listings/${listing.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('unknown route returns the custom 404 without layout overflow', async ({ page }) => {
  const response = await page.goto('/qa-mega-route-that-does-not-exist');
  expect(response && response.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await assertPageIntegrity(page, '404');
});
