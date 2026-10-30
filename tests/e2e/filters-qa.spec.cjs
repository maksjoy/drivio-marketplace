const { test, expect } = require('@playwright/test');

// Regression tests for the QA round on catalog filters (#31).
const PROJECTS = new Set(['desktop-chromium', 'android-pixel-chromium']);

function isMobile(testInfo) {
  return testInfo.project.name !== 'desktop-chromium';
}

async function ready(page) {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('main').getByText(/Loading cars…/)).toHaveCount(0, { timeout: 15_000 });
}

/** Where Make/Model/Location/price live: inline on desktop, in the sheet on mobile. */
async function basicControls(page, testInfo) {
  const filters = page.getByRole('region', { name: 'Vehicle search filters' });
  if (!isMobile(testInfo)) return filters;
  const dialog = page.getByRole('dialog', { name: 'Filters' });
  if (!(await dialog.isVisible())) await filters.getByRole('button', { name: /^Filters \(/ }).click();
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openDialog(page) {
  const dialog = page.getByRole('dialog', { name: 'Filters' });
  if (!(await dialog.isVisible())) {
    await page.getByRole('region', { name: 'Vehicle search filters' }).getByRole('button', { name: /^Filters \(/ }).click();
  }
  await expect(dialog).toBeVisible();
  return dialog;
}

function priceInputs(scope) {
  return {
    min: scope.getByLabel('Minimum price', { exact: true }).filter({ visible: true }),
    max: scope.getByLabel('Maximum price', { exact: true }).filter({ visible: true }),
  };
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(!PROJECTS.has(testInfo.project.name));
});

test('price range keeps every typed digit when moving between fields (QA 1)', async ({ page }, testInfo) => {
  await page.goto('/');
  await ready(page);
  const scope = await basicControls(page, testInfo);
  const { min, max } = priceInputs(scope);

  await min.click();
  await min.pressSequentially('30000', { delay: 40 });
  await max.click();
  await max.pressSequentially('10000', { delay: 40 });
  await expect(max).toHaveValue('10000');
  await expect(min).toHaveValue('30000');
  await max.press('Tab');
  // An inverted pair is swapped, never truncated.
  await expect(page).toHaveURL(/priceMin=10000&priceMax=30000/);
  await expect(min).toHaveValue('10000');
  await expect(max).toHaveValue('30000');

  // Same again with Tab, and with a URL commit (debounce) landing in the middle of typing.
  await min.fill('');
  await max.fill('');
  await max.press('Tab');
  await expect(page).not.toHaveURL(/price(Min|Max)=/);
  await min.click();
  await min.pressSequentially('15000', { delay: 40 });
  await min.press('Tab');
  await expect(max).toBeFocused();
  await max.pressSequentially('4', { delay: 40 });
  await page.waitForTimeout(900);
  await max.pressSequentially('5000', { delay: 40 });
  await expect(max).toHaveValue('45000');
  await expect(min).toHaveValue('15000');
  await max.press('Enter');
  await expect(page).toHaveURL(/priceMin=15000&priceMax=45000/);
  await expect(min).toHaveValue('15000');
  await expect(max).toHaveValue('45000');
});

test('invalid range params are normalised instead of breaking the page (QA 2)', async ({ page }, testInfo) => {
  const cases = [
    ['/?priceMin=30000&priceMax=10000', /\/\?priceMin=10000&priceMax=30000$/],
    ['/?mileageMin=-5', /\/$/],
    ['/?priceMax=-1', /\/$/],
    ['/?yearMin=2020&yearMax=2010', /\/\?yearMin=2010&yearMax=2020$/],
    ['/?priceMin=abc', /\/$/],
  ];
  for (const [url, normalised] of cases) {
    await page.goto(url);
    await ready(page);
    await expect(page, url).toHaveURL(normalised);
    await expect(page.getByText('Could not load listings'), url).toHaveCount(0);
    await expect(page.getByText('Invalid search filters'), url).toHaveCount(0);
    const chips = await page.getByRole('list', { name: 'Active filters' }).locator('button').allTextContents().catch(() => []);
    for (const chip of chips) expect(chip, url).not.toMatch(/NaN|-\s*\$|-\d|From -|Up to -/);
  }
  const scope = await basicControls(page, testInfo);
  const { min, max } = priceInputs(scope);
  await expect(min).toHaveAttribute('min', '0');
  await expect(max).toHaveAttribute('min', '0');
  const dialog = await openDialog(page);
  await expect(dialog.getByLabel('Year from', { exact: true })).toHaveAttribute('min', '1980');
  await expect(dialog.getByLabel('Mileage to', { exact: true })).toHaveAttribute('min', '0');
});

test('empty results offer Reset filters (QA 3)', async ({ page }) => {
  await page.goto('/?priceMin=1999000');
  await ready(page);
  await expect(page.getByText('No listings match these filters.')).toBeVisible();
  const reset = page.getByRole('main').getByRole('button', { name: 'Reset filters' });
  await expect(reset).toBeVisible();
  await reset.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('main article').first()).toBeVisible();
  // The chip-row Clear all is still the first Clear all inside the filters region.
  await page.goto('/?priceMin=1999000');
  await ready(page);
  const clear = page.getByRole('region', { name: 'Vehicle search filters' }).getByRole('button', { name: 'Clear all' }).first();
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(page).toHaveURL(/\/$/);
});

test('Back/Forward step through filter states; typing adds one entry (QA 4)', async ({ page, context }, testInfo) => {
  await page.goto('/');
  await ready(page);
  let scope = await basicControls(page, testInfo);
  await scope.getByLabel('Make', { exact: true }).filter({ visible: true }).selectOption({ label: 'Toyota' });
  await expect(page).toHaveURL(/\?make=Toyota$/);

  const dialog = await openDialog(page);
  await dialog.getByRole('checkbox', { name: 'SUV', exact: true }).click();
  await expect(page).toHaveURL(/make=Toyota&bodyType=SUV/);

  if (!isMobile(testInfo)) await dialog.getByRole('button', { name: 'Close' }).click();

  // Typing with a pause longer than the debounce still yields a single history entry.
  const { min } = priceInputs(await basicControls(page, testInfo));
  await min.click();
  await min.pressSequentially('25', { delay: 40 });
  await page.waitForTimeout(900);
  await min.pressSequentially('000', { delay: 40 });
  await min.press('Enter');
  await expect(page).toHaveURL(/make=Toyota&priceMin=25000&bodyType=SUV/);
  if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Close' }).click();

  await page.goBack();
  await expect(page).toHaveURL(/\?make=Toyota&bodyType=SUV$/);
  scope = await basicControls(page, testInfo);
  await expect(priceInputs(scope).min).toHaveValue('');
  await page.goBack();
  await expect(page).toHaveURL(/\?make=Toyota$/);
  await expect(page.getByRole('list', { name: 'Active filters' }).getByRole('button', { name: /SUV/ })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  scope = await basicControls(page, testInfo);
  await expect(scope.getByLabel('Make', { exact: true }).filter({ visible: true })).toHaveValue('');
  await page.goForward();
  await expect(page).toHaveURL(/\?make=Toyota$/);
  await expect(scope.getByLabel('Make', { exact: true }).filter({ visible: true })).toHaveValue('Toyota');
  await ready(page);

  // A fresh tab restores the same state from the URL.
  const other = await context.newPage();
  await other.goto('/?make=Toyota&priceMin=25000&bodyType=SUV');
  await ready(other);
  await expect(other.getByRole('list', { name: 'Active filters' }).getByRole('button', { name: /SUV/ })).toBeVisible();
  await expect(other.getByRole('list', { name: 'Active filters' }).getByRole('button', { name: /From \$25,000/ })).toBeVisible();
  await other.close();
});

test('number fields apply on Enter and after a typing pause (QA 5)', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const dialog = await openDialog(page);
  const mileageTo = dialog.getByLabel('Mileage to', { exact: true });
  await mileageTo.click();
  await mileageTo.pressSequentially('120000', { delay: 30 });
  await mileageTo.press('Enter');
  await expect(page).toHaveURL(/mileageMax=120000/);
  await expect(mileageTo).toBeFocused();

  const yearFrom = dialog.getByLabel('Year from', { exact: true });
  await yearFrom.click();
  await yearFrom.pressSequentially('2015', { delay: 30 });
  // No blur, no Enter: the debounce applies it.
  await expect(page).toHaveURL(/yearMin=2015/, { timeout: 3000 });
  await expect(yearFrom).toBeFocused();
  await expect(yearFrom).toHaveValue('2015');

  // Double-clicking Show right after typing still applies the value.
  const mileageFrom = dialog.getByLabel('Mileage from', { exact: true });
  await mileageFrom.click();
  await mileageFrom.pressSequentially('1000', { delay: 30 });
  await dialog.getByRole('button', { name: /^Show .*cars?$/ }).dblclick();
  await expect(page).toHaveURL(/mileageMin=1000&mileageMax=120000/);
});

test('Show N car(s) is singular for 1 and ignores stale counts (QA 6)', async ({ page, request }) => {
  const body = await (await request.get('/api/listings')).json();
  const listing = body.listings[0];
  const query = `make=${encodeURIComponent(listing.make)}&priceMin=${listing.price}&priceMax=${listing.price}`;
  const check = await (await request.get(`/api/catalog?${query}`)).json();
  test.skip((check.listings || []).length !== 1 || check.hasMore, 'needs a filter that matches exactly one listing');

  await page.goto(`/?${query}`);
  await ready(page);
  const dialog = await openDialog(page);
  await expect(dialog.getByRole('button', { name: 'Show 1 car', exact: true })).toBeVisible();

  // Make the next request (bodyType=SUV) slow and the one after it fast: the slow, older
  // response must not overwrite the newer count or results.
  let delayed = false;
  await page.route(/\/api\/catalog\?.*bodyType=SUV(&|$)(?!.*fuel)/, async (route) => {
    delayed = true;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => {});
  });
  await dialog.getByRole('checkbox', { name: 'SUV', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Electric', exact: true }).click();
  await expect(page).toHaveURL(/fuel=Electric/);
  await page.waitForTimeout(2000);
  expect(delayed).toBe(true);
  const cards = await page.locator('main article').count();
  const label = await dialog.getByRole('button', { name: /^Show .*cars?$/ }).textContent();
  expect(label).toBe(`Show ${cards} ${cards === 1 ? 'car' : 'cars'}`);
});

test('AWD/4WD quick chip reads "Any AWD/4WD" and selects both (QA 7)', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const dialog = await openDialog(page);
  const drivetrain = dialog.getByRole('group', { name: 'Drivetrain' });
  const quick = drivetrain.getByRole('checkbox', { name: 'Any AWD/4WD', exact: true });
  await expect(quick).toBeVisible();
  await expect(drivetrain.getByRole('checkbox', { name: 'AWD/4WD', exact: true })).toHaveCount(0);
  await quick.click();
  await expect(page).toHaveURL(/drivetrain=AWD%2C4WD/);
  await expect(drivetrain.getByRole('checkbox', { name: 'AWD', exact: true })).toBeChecked();
  await expect(drivetrain.getByRole('checkbox', { name: '4WD', exact: true })).toBeChecked();
});

test('results show a loading skeleton, never a blank list, before an empty state', async ({ page }) => {
  await page.route(/\/api\/catalog\?priceMin=1999000/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue().catch(() => {});
  });
  await page.goto('/?priceMin=1999000');
  await expect(page.getByRole('main').getByLabel('Loading cars')).toBeVisible();
  await expect(page.getByText('No listings match these filters.')).toBeVisible();
  await expect(page.getByRole('main').getByLabel('Loading cars')).toHaveCount(0);
});
