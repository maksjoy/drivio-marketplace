const { test, expect } = require('@playwright/test');

function qaUser(runId, suffix) {
  return {
    email: `qa-lifecycle-${runId}-${suffix}@example.invalid`,
    password: `Qa-${runId}-${suffix}-Launch!9a`,
  };
}

async function waitForProvisionedAccount(page, user) {
  await page.goto('/login');
  console.log(`QA_WAIT_PROVISION:${user.email}`);

  const deadline = Date.now() + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    const result = await page.evaluate(async ({ email, password }) => {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signin', email, password }),
      });
      return { ok: response.ok, status: response.status };
    }, user);
    if (result.ok) {
      await page.goto('/account');
      await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
      return;
    }
    await page.waitForTimeout(4000);
  }
  throw new Error(`QA account was not provisioned in time: ${user.email}`);
}

async function getRealPhotoBuffer(page) {
  const payload = await page.evaluate(async () => {
    const response = await fetch('/api/listings');
    if (!response.ok) throw new Error('Could not read public listings for QA photo source.');
    return response.json();
  });
  const source = (payload.listings || []).find((listing) => Array.isArray(listing.images) && listing.images.length > 0);
  if (!source) throw new Error('No public listing with a real stored photo is available for the upload lifecycle test.');
  const response = await fetch(source.images[0]);
  if (!response.ok) throw new Error(`Could not download QA photo source: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function submitListing(page, photoBuffer, vehicle) {
  await page.goto('/sell');
  await expect(page.getByRole('heading', { name: 'Sell your car' })).toBeVisible();
  const form = page.locator('form');
  await form.locator('select[name="make"]').selectOption(vehicle.make);
  await form.locator('select[name="model"]').selectOption(vehicle.model);
  await form.locator('input[name="year"]').fill(String(vehicle.year));
  await form.locator('input[name="price"]').fill(String(vehicle.price));
  await form.locator('input[name="mileage"]').fill(String(vehicle.mileage));
  await form.locator('select[name="fuel"]').selectOption(vehicle.fuel);
  await form.locator('details').evaluate((element) => { element.open = true; });
  await form.locator('select[name="bodyType"]').selectOption(vehicle.bodyType);
  await form.locator('select[name="city"]').selectOption(vehicle.city);
  await form.locator('select[name="transmission"]').selectOption(vehicle.transmission);
  await form.locator('select[name="drivetrain"]').selectOption(vehicle.drivetrain);
  await form.locator('input[name="color"]').fill(vehicle.color);
  await form.locator('input[name="engine"]').fill(vehicle.engine);
  await form.locator('textarea[name="description"]').fill(vehicle.description);
  const firstFeature = form.locator('input[name="features"]').first();
  if (await firstFeature.count()) await firstFeature.check();
  await form.locator('input[name="images"]').setInputFiles({ name: `${vehicle.make}-${vehicle.model}-qa.jpg`, mimeType: 'image/jpeg', buffer: photoBuffer });
  await form.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.locator('body')).toContainText('Submitted for review', { timeout: 30000 });
  await page.waitForURL(/\/account$/, { timeout: 20000 });

  const row = page.locator('div.rounded-xl').filter({ hasText: `${vehicle.year} ${vehicle.make} ${vehicle.model}` }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(/pending/i);
  const href = await row.locator('a[href^="/listings/"]').getAttribute('href');
  if (!href) throw new Error(`Could not determine new listing ID for ${vehicle.make} ${vehicle.model}.`);
  const id = href.split('/').pop();
  console.log(`QA_WAIT_APPROVAL:${id}:${vehicle.year} ${vehicle.make} ${vehicle.model}`);
  return id;
}

async function waitForActive(page, listingId) {
  const deadline = Date.now() + 4 * 60 * 1000;
  while (Date.now() < deadline) {
    await page.goto('/account');
    const link = page.locator(`a[href="/listings/${listingId}"]`);
    if (await link.count()) {
      const row = link.locator('xpath=..');
      const status = row.locator('span.uppercase').first();
      if ((await status.textContent().catch(() => ''))?.trim().toLowerCase() === 'active') return;
    }
    await page.waitForTimeout(4000);
  }
  throw new Error(`QA listing was not approved in time: ${listingId}`);
}

async function deleteOwnListing(page, listingId) {
  await page.goto('/account');
  const link = page.locator(`a[href="/listings/${listingId}"]`);
  if (!(await link.count())) return;
  const row = link.locator('xpath=..');
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator(`a[href="/listings/${listingId}"]`)).toHaveCount(0, { timeout: 15000 });
}

test('two real QA users can post real-photo listings, favorite, message, sell and delete', async ({ browser }, testInfo) => {
  test.skip(process.env.RUN_AUTH_LIFECYCLE !== '1', 'One-time lifecycle QA runs only from the dedicated workflow.');
  test.skip(testInfo.project.name !== 'desktop-chromium');
  test.setTimeout(11 * 60 * 1000);

  const runId = process.env.GITHUB_RUN_ID || String(Date.now());
  const alpha = qaUser(runId, 'alpha');
  const bravo = qaUser(runId, 'bravo');
  const alphaContext = await browser.newContext();
  const bravoContext = await browser.newContext();
  const alphaPage = await alphaContext.newPage();
  const bravoPage = await bravoContext.newPage();

  const alphaVehicle = {
    make: 'Toyota', model: 'RAV4', year: 2021, price: 28750, mileage: 68420,
    fuel: 'Gasoline', bodyType: 'SUV', city: 'Edmonton', transmission: 'Automatic', drivetrain: 'AWD',
    color: 'Silver', engine: '2.5',
    description: `QA LIFECYCLE ${runId} ALPHA — real-photo pre-launch test. Clean Alberta SUV, regular service history, no warning lights. This listing exists only to validate the complete publishing flow and will be removed after QA.`,
  };
  const bravoVehicle = {
    make: 'Honda', model: 'CR-V', year: 2020, price: 25900, mileage: 79210,
    fuel: 'Gasoline', bodyType: 'SUV', city: 'Calgary', transmission: 'Automatic', drivetrain: 'AWD',
    color: 'White', engine: '1.5',
    description: `QA LIFECYCLE ${runId} BRAVO — real-photo pre-launch test. Well-kept Alberta crossover with normal wear and documented maintenance. This listing exists only to validate the complete publishing flow and will be removed after QA.`,
  };

  let alphaListingId;
  let bravoListingId;
  try {
    await waitForProvisionedAccount(alphaPage, alpha);
    const photo = await getRealPhotoBuffer(alphaPage);
    alphaListingId = await submitListing(alphaPage, photo, alphaVehicle);
    await waitForActive(alphaPage, alphaListingId);
    await alphaPage.goto(`/listings/${alphaListingId}`);
    await expect(alphaPage.getByRole('heading', { name: `${alphaVehicle.year} ${alphaVehicle.make} ${alphaVehicle.model}` })).toBeVisible();
    await expect(alphaPage.getByRole('button', { name: /Open photo 1 of 1 fullscreen/ })).toBeVisible();

    await waitForProvisionedAccount(bravoPage, bravo);
    bravoListingId = await submitListing(bravoPage, photo, bravoVehicle);
    await waitForActive(bravoPage, bravoListingId);
    await bravoPage.goto(`/listings/${bravoListingId}`);
    await expect(bravoPage.getByRole('heading', { name: `${bravoVehicle.year} ${bravoVehicle.make} ${bravoVehicle.model}` })).toBeVisible();

    await bravoPage.goto(`/listings/${alphaListingId}`);
    await bravoPage.getByRole('button', { name: 'Add to favorites' }).first().click();
    await expect(bravoPage.getByRole('button', { name: 'Remove from favorites' }).first()).toBeVisible();
    await bravoPage.goto('/favorites');
    await expect(bravoPage.getByText(`${alphaVehicle.year} ${alphaVehicle.make} ${alphaVehicle.model}`)).toBeVisible();

    await bravoPage.goto(`/listings/${alphaListingId}`);
    await bravoPage.getByRole('button', { name: 'Message seller' }).first().click();
    await bravoPage.waitForURL(/\/messages\/[0-9a-f-]+$/i);
    const conversationUrl = bravoPage.url();
    const message = `QA buyer message ${runId}: Is this vehicle still available?`;
    await bravoPage.getByPlaceholder('Write a message…').fill(message);
    await bravoPage.getByRole('button', { name: 'Send' }).click();
    await expect(bravoPage.getByText(message)).toBeVisible();

    await alphaPage.goto(conversationUrl);
    await expect(alphaPage.getByText(message)).toBeVisible({ timeout: 15000 });
    const reply = `QA seller reply ${runId}: Yes, it is available.`;
    await alphaPage.getByPlaceholder('Write a message…').fill(reply);
    await alphaPage.getByRole('button', { name: 'Send' }).click();
    await expect(alphaPage.getByText(reply)).toBeVisible();

    await alphaPage.goto('/account');
    const alphaLink = alphaPage.locator(`a[href="/listings/${alphaListingId}"]`);
    const alphaRow = alphaLink.locator('xpath=..');
    const markSold = alphaRow.getByRole('button', { name: 'Mark sold' });
    await markSold.click();
    await expect(markSold).toHaveCount(0, { timeout: 15000 });
    await expect(alphaRow.locator('span.uppercase').first()).toHaveText(/^sold$/i, { timeout: 15000 });
    await alphaPage.goto(`/listings/${alphaListingId}`);
    await expect(alphaPage.getByText('SOLD', { exact: true })).toBeVisible({ timeout: 15000 });
  } finally {
    if (bravoListingId) await deleteOwnListing(bravoPage, bravoListingId).catch(() => undefined);
    if (alphaListingId) await deleteOwnListing(alphaPage, alphaListingId).catch(() => undefined);
    await alphaContext.close();
    await bravoContext.close();
  }
});
