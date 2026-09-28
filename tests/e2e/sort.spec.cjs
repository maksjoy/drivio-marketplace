const { test, expect } = require('@playwright/test');

const PROJECTS = new Set(['desktop-chromium', 'android-pixel-chromium']);

function numbersFromMoney(texts) {
  return texts.map((text) => Number(String(text).replace(/[^0-9.]/g, ''))).filter(Number.isFinite);
}

test('sort selector updates URL without page jump and changes catalog ordering', async ({ page }, testInfo) => {
  test.skip(!PROJECTS.has(testInfo.project.name));
  await page.goto('/');
  const sort = page.getByLabel('Sort listings');
  await expect(sort).toBeVisible();
  await expect(sort).toHaveValue('recent');

  await sort.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await sort.selectOption('price_asc');
  await expect(page).toHaveURL(/sort=price_asc/);
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(12);

  await expect(page.getByText(/listings shown/)).toBeVisible({ timeout: 15000 });
  const prices = numbersFromMoney(await page.locator('article p.text-\[26px\]').allTextContents());
  expect(prices.length).toBeGreaterThan(1);
  expect(prices).toEqual([...prices].sort((a, b) => a - b));

  await sort.selectOption('price_desc');
  await expect(page).toHaveURL(/sort=price_desc/);
  await expect(page.getByText(/listings shown/)).toBeVisible({ timeout: 15000 });
  const desc = numbersFromMoney(await page.locator('article p.text-\[26px\]').allTextContents());
  expect(desc).toEqual([...desc].sort((a, b) => b - a));

  await sort.selectOption('year_desc');
  await expect(page).toHaveURL(/sort=year_desc/);
  await sort.selectOption('year_asc');
  await expect(page).toHaveURL(/sort=year_asc/);
  await sort.selectOption('mileage_asc');
  await expect(page).toHaveURL(/sort=mileage_asc/);
  await sort.selectOption('recent');
  await expect(page).not.toHaveURL(/sort=/);
});
