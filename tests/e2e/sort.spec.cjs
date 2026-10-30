const { test, expect } = require('@playwright/test');

const PROJECTS = new Set(['desktop-chromium', 'android-pixel-chromium']);

function numbersFromMoney(texts) {
  return texts.map((text) => Number(String(text).replace(/[^0-9.]/g, ''))).filter(Number.isFinite);
}

async function cardPrices(page) {
  const texts = await page.locator('article').evaluateAll((articles) => articles.map((article) => {
    const price = Array.from(article.querySelectorAll('p')).find((element) => String(element.className).includes('text-[26px]'));
    return price?.textContent || '';
  }));
  return numbersFromMoney(texts);
}

test('sort selector updates URL without page jump and changes catalog ordering', async ({ page }, testInfo) => {
  test.skip(!PROJECTS.has(testInfo.project.name));
  await page.goto('/');
  // React streams the resolved Suspense content into a hidden <div> at the end of
  // <body> before swapping it in, so getByLabel can briefly see two selects.
  // getByRole skips hidden nodes, and scoping to <main> pins the rendered one.
  const sort = page.getByRole('main').getByRole('combobox', { name: 'Sort listings' });
  await expect(sort).toBeVisible();
  await expect(sort).toHaveValue('recent');

  await sort.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await sort.selectOption('price_asc');
  await expect(page).toHaveURL(/sort=price_asc/);
  const after = await page.evaluate(() => window.scrollY);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(12);

  await expect(page.getByText(/\d+ cars? in Alberta/)).toBeVisible({ timeout: 15000 });
  const prices = await cardPrices(page);
  expect(prices.length).toBeGreaterThan(1);
  expect(prices).toEqual([...prices].sort((a, b) => a - b));

  await sort.selectOption('price_desc');
  await expect(page).toHaveURL(/sort=price_desc/);
  await expect(page.getByText(/\d+ cars? in Alberta/)).toBeVisible({ timeout: 15000 });
  const desc = await cardPrices(page);
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
