const { test, expect } = require('@playwright/test');

// QA: price entry in the mobile filter sheet. Tagged @key so it also runs in CI on the
// iphone-webkit / iphone-small-webkit projects, not only the android chromium ones.
const MOBILE = /^(android-pixel-chromium|android-small-chromium|iphone-webkit|iphone-small-webkit)$/;
const WANT_URL = /[?&]priceMin=5000&priceMax=30000(&|$)/;
const WANT_CHIP = '$5,000–$30,000';

test.beforeEach(async ({}, testInfo) => {
  test.skip(!MOBILE.test(testInfo.project.name), 'mobile filter sheet only');
});

async function openSheet(page) {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('main').getByText(/Loading cars…/)).toHaveCount(0, { timeout: 15_000 });
  const dialog = page.getByRole('dialog', { name: 'Filters' });
  await page.getByRole('region', { name: 'Vehicle search filters' }).getByRole('button', { name: /^Filters \(/ }).click();
  await expect(dialog).toBeVisible();
  return {
    dialog,
    min: dialog.getByLabel('Minimum price', { exact: true }),
    max: dialog.getByLabel('Maximum price', { exact: true }),
  };
}

async function expectApplied(page, min, max) {
  await expect(min).toHaveValue('5000');
  await expect(max).toHaveValue('30000');
  await expect(page).toHaveURL(WANT_URL);
  const url = new URL(page.url());
  expect(url.searchParams.get('priceMin')).toBe('5000');
  expect(url.searchParams.get('priceMax')).toBe('30000');
  const chips = page.locator('ul[aria-label="Active filters"]').first().locator('button');
  await expect(chips.filter({ hasText: '$' })).toHaveText([`${WANT_CHIP}×`]);
  // Values stay put after the 600ms typing-pause commit has had time to fire again.
  await page.waitForTimeout(900);
  await expect(min).toHaveValue('5000');
  await expect(max).toHaveValue('30000');
  await expect(page).toHaveURL(WANT_URL);
}

test('mobile sheet: fill() Min then Max applies exact price params @key', async ({ page }) => {
  await page.goto('/');
  const { min, max } = await openSheet(page);
  await min.fill('5000');
  await max.fill('30000');
  await max.press('Enter');
  await expectApplied(page, min, max);
});

test('mobile sheet: typing digit by digit and tapping between fields @key', async ({ page }) => {
  await page.goto('/');
  const { min, max } = await openSheet(page);
  await min.tap();
  await min.pressSequentially('5000', { delay: 60 });
  await max.tap();
  await expect(min).toHaveValue('5000');
  // A pause longer than the 600ms debounce in the middle of typing must not drop or append digits.
  await max.pressSequentially('30', { delay: 60 });
  await page.waitForTimeout(900);
  await max.pressSequentially('000', { delay: 60 });
  await expect(max).toHaveValue('30000');
  await min.tap();
  await expectApplied(page, min, max);
});

test('mobile sheet: select-all and type over existing values @key', async ({ page }) => {
  await page.goto('/?priceMin=1000&priceMax=2000');
  const { min, max } = await openSheet(page);
  await expect(min).toHaveValue('1000');
  await expect(max).toHaveValue('2000');
  await min.tap();
  await min.selectText();
  await min.pressSequentially('5000', { delay: 60 });
  await expect(min).toHaveValue('5000');
  await max.tap();
  await max.selectText();
  await max.pressSequentially('30000', { delay: 60 });
  await expect(max).toHaveValue('30000');
  await min.tap();
  await expectApplied(page, min, max);
});
