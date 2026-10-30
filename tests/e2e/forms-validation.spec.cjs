const path = require('node:path');
const { test, expect } = require('@playwright/test');

// Sell and edit forms need a Supabase session, and e2e must never write to the real database.
// These tests drive the forms on /e2e-harness/* (rendered only when the server runs with
// E2E_FORM_HARNESS=1) and mock every POST/PATCH with page.route. Nothing reaches Supabase.
const PHOTO = path.join(__dirname, '..', 'fixtures', 'car-photo.png');
const YEAR_MAX = new Date().getFullYear() + 1;
const MSG = {
  engine: 'Enter engine volume from 0.6 to 8.5 L.',
  power: 'Enter power from 40 to 1500 hp.',
  year: `Enter a year from 1980 to ${YEAR_MAX}.`,
  price: 'Enter a price from $500 to $2,000,000.',
  mileage: 'Enter mileage from 0 to 2,000,000 km.',
  make: 'Choose a make.',
  photos: 'Add between 1 and 8 photos.',
};

const CHROMIUM = new Set(['desktop-chromium', 'android-pixel-chromium', 'android-small-chromium']);

async function openHarness(page, which) {
  const response = await page.goto(`/e2e-harness/${which}`);
  if (response && response.status() === 404) {
    if (process.env.CI) throw new Error('E2E_FORM_HARNESS=1 is not set for the e2e server.');
    test.skip(true, 'Start the server with E2E_FORM_HARNESS=1 to run the form harness tests.');
  }
  await expect(page.getByRole('button', { name: which === 'sell' ? 'Submit for review' : 'Save changes' })).toBeVisible();
}

/** Writes must never leave the browser: fail the test if anything but the mock answers. */
async function trackWrites(page, method, urlGlob, respond) {
  const calls = [];
  await page.route(urlGlob, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    calls.push(route.request());
    await respond(route);
  });
  return calls;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function expectFieldError(page, id, message) {
  const field = page.locator(`#${id}`);
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  const error = page.locator(`#${id}-error`);
  await expect(error).toHaveText(message);
  await expect(error).toBeVisible();
  const describedBy = (await field.getAttribute('aria-describedby')) || '';
  expect(describedBy.split(/\s+/)).toContain(`${id}-error`);
  await expect(field).toHaveAccessibleDescription(new RegExp(escapeRegExp(message)));
}

async function expectFieldOk(page, id) {
  await expect(page.locator(`#${id}`)).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator(`#${id}-error`)).toHaveCount(0);
}

async function blurWith(page, id, value) {
  const field = page.locator(`#${id}`);
  await field.fill(value);
  await field.blur();
}

async function fillValidSell(page) {
  await page.locator('#sell-make').selectOption('Toyota');
  await page.locator('#sell-model').selectOption('RAV4');
  await page.locator('#sell-year').fill('2019');
  await page.locator('#sell-price').fill('28500');
  await page.locator('#sell-mileage').fill('64000');
  await page.locator('#sell-fuel').selectOption('Gasoline');
  await page.locator('#sell-images').setInputFiles(PHOTO);
}

test.describe('sell form (harness, mocked API)', () => {
  test.beforeEach(({}, testInfo) => test.skip(!CHROMIUM.has(testInfo.project.name) && !/webkit|firefox/.test(testInfo.project.name)));

  test('blur shows field-level errors with the server wording @key', async ({ page }) => {
    await openHarness(page, 'sell');

    for (const value of ['-1', 'abc', '99']) {
      await blurWith(page, 'sell-engine', value);
      await expectFieldError(page, 'sell-engine', MSG.engine);
    }
    await page.locator('#sell-engine').fill('2.5');
    await expectFieldOk(page, 'sell-engine'); // clears while typing once fixed

    for (const value of ['39', '1501']) {
      await blurWith(page, 'sell-power', value);
      await expectFieldError(page, 'sell-power', MSG.power);
    }
    await blurWith(page, 'sell-power', '180');
    await expectFieldOk(page, 'sell-power');

    for (const value of [String(YEAR_MAX + 1), '1979']) {
      await blurWith(page, 'sell-year', value);
      await expectFieldError(page, 'sell-year', MSG.year);
    }
    await blurWith(page, 'sell-year', String(YEAR_MAX));
    await expectFieldOk(page, 'sell-year');

    await blurWith(page, 'sell-price', '499');
    await expectFieldError(page, 'sell-price', MSG.price);
    await blurWith(page, 'sell-price', '500');
    await expectFieldOk(page, 'sell-price');

    // A required field left empty after focusing it shows its error on blur…
    await page.locator('#sell-mileage').focus();
    await page.locator('#sell-mileage').blur();
    await expectFieldError(page, 'sell-mileage', MSG.mileage);
    await page.locator('#sell-mileage').fill('0');
    await expectFieldOk(page, 'sell-mileage');
    // …while required fields the seller never focused stay quiet until submit.
    await expectFieldOk(page, 'sell-make');
    await expectFieldOk(page, 'sell-fuel');
  });

  test('submit with errors focuses the first invalid field and sends nothing @key', async ({ page }) => {
    await openHarness(page, 'sell');
    const posts = await trackWrites(page, 'POST', '**/api/listings', (route) => route.fulfill({ status: 500, json: { error: 'should not be called' } }));
    const submit = page.getByRole('button', { name: 'Submit for review' });

    await submit.click();
    await expect(page.locator('#sell-make')).toBeFocused();
    await expect(page.locator('#sell-make')).toBeInViewport();
    await expectFieldError(page, 'sell-make', MSG.make);
    await expectFieldError(page, 'sell-photos'.replace('photos', 'images'), MSG.photos);
    await expect(page.getByText(/Fix the \d+ highlighted fields before submitting\./)).toBeVisible();

    await fillValidSell(page);
    await page.locator('#sell-engine').fill('abc');
    await page.locator('#sell-mileage').fill('-5');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await submit.click();
    await expect(page.locator('#sell-mileage')).toBeFocused(); // mileage comes before engine on screen
    await expect(page.locator('#sell-mileage')).toBeInViewport();
    await expectFieldError(page, 'sell-mileage', MSG.mileage);
    await expectFieldError(page, 'sell-engine', MSG.engine);
    await expect(page.getByText('Fix the 2 highlighted fields before submitting.')).toBeVisible();
    expect(posts).toHaveLength(0);
  });

  test('a server 400 shows its message and focuses the named field', async ({ page }) => {
    await openHarness(page, 'sell');
    const posts = await trackWrites(page, 'POST', '**/api/listings', (route) => route.fulfill({ status: 400, json: { error: MSG.price, field: 'price' } }));
    await fillValidSell(page);
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /./ })).toHaveText(MSG.price);
    await expectFieldError(page, 'sell-price', MSG.price);
    await expect(page.locator('#sell-price')).toBeFocused();
    expect(posts).toHaveLength(1);
    const sent = posts[0].postData() || '';
    expect(sent).toContain('name="price"');
    expect(sent).not.toContain('name="images"'); // photos go straight to storage, never in the POST

    await page.unroute('**/api/listings');
    await trackWrites(page, 'POST', '**/api/listings', (route) => route.fulfill({ status: 429, json: { error: 'Please wait before creating another listing.' } }));
    await page.locator('#sell-price').fill('29000');
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /./ })).toHaveText('Please wait before creating another listing.');
    await expectFieldOk(page, 'sell-price');
  });

  test('photo preview appears after choosing a file and goes away when removed', async ({ page }) => {
    await openHarness(page, 'sell');
    await page.locator('#sell-images').setInputFiles([PHOTO, PHOTO]);
    const list = page.getByRole('list', { name: 'Selected photos' });
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByText('2 of 8 photos', { exact: true })).toBeVisible();
    const preview = list.getByRole('listitem').first().locator('img');
    await expect(preview).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => preview.evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Remove photo 2' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await page.getByRole('button', { name: 'Remove photo 1' }).click();
    await expect(list).toHaveCount(0);
    await expect(page.locator('#sell-images')).toBeFocused();
    expect(await page.locator('#sell-images').evaluate((input) => input.files.length)).toBe(0);
  });
});

test.describe('edit form (harness, mocked API)', () => {
  test('submit with errors focuses the first invalid field; a valid save PATCHes once @key', async ({ page }) => {
    await openHarness(page, 'edit');
    const patches = await trackWrites(page, 'PATCH', '**/api/listings/*', (route) => route.fulfill({ json: { ok: true, status: 'pending' } }));
    const save = page.getByRole('button', { name: 'Save changes' });

    await page.locator('#edit-year').fill('1900');
    await page.locator('#edit-engine').fill('99');
    await page.locator('#edit-power').fill('39');
    await page.locator('#edit-description').focus(); // focus elsewhere, then submit from the button
    await save.click();
    await expect(page.locator('#edit-year')).toBeFocused();
    await expect(page.locator('#edit-year')).toBeInViewport();
    await expectFieldError(page, 'edit-year', MSG.year);
    await expectFieldError(page, 'edit-engine', MSG.engine);
    await expectFieldError(page, 'edit-power', MSG.power);
    await expect(page.getByText('Fix the 3 highlighted fields before saving.')).toBeVisible();

    await page.locator('#edit-year').fill('2019');
    await expectFieldOk(page, 'edit-year');
    await save.click();
    await expect(page.locator('#edit-engine')).toBeFocused();
    expect(patches).toHaveLength(0);

    await page.locator('#edit-engine').fill('2.5');
    await page.locator('#edit-power').fill('203');
    await save.click();
    await expect(page).toHaveURL(`/listings/00000000-0000-4000-8000-0000000000e2?saved=1`);
    expect(patches).toHaveLength(1);
    expect(JSON.parse(patches[0].postData())).toMatchObject({ make: 'Toyota', model: 'RAV4', year: '2019', engineL: '2.5', powerHp: '203' });
  });

  test('edit: a server 400 shows its message and focuses the named field', async ({ page }) => {
    await openHarness(page, 'edit');
    await trackWrites(page, 'PATCH', '**/api/listings/*', (route) => route.fulfill({ status: 400, json: { error: MSG.power, field: 'powerHp' } }));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(MSG.power).first()).toBeVisible();
    await expectFieldError(page, 'edit-power', MSG.power);
    await expect(page.locator('#edit-power')).toBeFocused();
  });

  const EDIT_ID = '00000000-0000-4000-8000-0000000000e2';

  test('valid Save changes PATCHes edited values once, shows Saving…, and lands on /listings/[id]?saved=1 @key', async ({ page }) => {
    await openHarness(page, 'edit');
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const calls = [];
    await page.route('**/api/listings/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      calls.push(route.request());
      await gate;
      await route.fulfill({ status: 200, json: { ok: true, status: 'pending' } });
    });
    await page.locator('#edit-price').fill('27900');
    await page.locator('#edit-description').fill('Updated by the save test.');
    const save = page.getByRole('button', { name: 'Save changes' });
    const pending = save.click();
    await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    release();
    await pending;
    await expect(page).toHaveURL(`/listings/${EDIT_ID}?saved=1`);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].postData())).toMatchObject({
      make: 'Toyota',
      model: 'RAV4',
      price: '27900',
      description: 'Updated by the save test.',
    });
    // The listing page shows this sentence only to the signed-in owner, and never from the query.
    // The harness is that owner, with the same hardcoded Notice.
    await page.goto('/e2e-harness/edit?panel=closed&saved=1');
    const notice = page.getByRole('status').filter({ hasText: 'Submitted for review.' });
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText('Submitted for review.');
  });

  test('a 4xx or 5xx PATCH shows an inline error, does not navigate, and re-enables Save @key', async ({ page }) => {
    await openHarness(page, 'edit');
    const editUrl = page.url();
    const cases = [
      [400, 'Check the listing details.'],
      [500, 'The server could not save this listing.'],
    ];
    for (const [status, message] of cases) {
      await page.unroute('**/api/listings/*').catch(() => {});
      await page.route('**/api/listings/*', (route) => {
        if (route.request().method() !== 'PATCH') return route.fallback();
        return route.fulfill({ status, json: { error: message } });
      });
      const save = page.getByRole('button', { name: 'Save changes' });
      await save.click();
      // Server errors render in the danger Notice. That component is role="status", not role="alert".
      const inline = page.getByRole('status').filter({ hasText: message });
      await expect(inline).toBeVisible();
      await expect(page).toHaveURL(editUrl);
      await expect(save).toBeEnabled();
      await expect(save).toHaveText('Save changes');
    }
  });

  test('at 390px the Cancel and Save bar stays visible and clear of the last field @key', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHarness(page, 'edit');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const field = page.locator('#edit-description');
    const save = page.getByRole('button', { name: 'Save changes' });
    const cancel = page.getByRole('link', { name: 'Cancel' });
    const bar = page.locator('form div').filter({ has: save }).last();
    await expect(save).toBeVisible();
    await expect(cancel).toBeVisible();
    const fieldBox = await field.boundingBox();
    const barBox = await bar.boundingBox();
    const saveBox = await save.boundingBox();
    const cancelBox = await cancel.boundingBox();
    expect(fieldBox).toBeTruthy();
    expect(barBox).toBeTruthy();
    expect(saveBox.height).toBeGreaterThanOrEqual(44);
    expect(cancelBox.height).toBeGreaterThanOrEqual(44);
    expect(saveBox.y).toBeGreaterThanOrEqual(0);
    expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(844);
    expect(cancelBox.y).toBeGreaterThanOrEqual(0);
    expect(Math.round(fieldBox.y + fieldBox.height)).toBeLessThanOrEqual(Math.round(barBox.y) + 1);
  });
});

test('form harness pages are CSP-clean (Zod stays out of the client bundle)', async ({ page }, testInfo) => {
  test.skip(!CHROMIUM.has(testInfo.project.name));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}`), true);
  });
  await openHarness(page, 'sell');
  await page.locator('#sell-images').setInputFiles(PHOTO);
  await page.locator('#sell-engine').fill('abc');
  await page.locator('#sell-engine').blur();
  await expect(page.locator('#sell-engine-error')).toBeVisible();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
  await openHarness(page, 'edit');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
});

test.describe('range chips and page titles', () => {
  test.beforeEach(({}, testInfo) => test.skip(!CHROMIUM.has(testInfo.project.name)));

  test('one-sided ranges get a removable chip', async ({ page }) => {
    const cases = [
      ['/?priceMax=30000', 'Up to $30,000'],
      ['/?priceMin=5000', 'From $5,000'],
      ['/?priceMin=0&priceMax=30000', 'Up to $30,000'],
      ['/?yearMin=2015', 'From 2015'],
      ['/?yearMax=2018', 'Up to 2018'],
      ['/?mileageMax=100000', 'Up to 100,000 km'],
      ['/?engineMin=2', 'From 2.0 L'],
      ['/?powerMax=300', 'Up to 300 hp'],
    ];
    for (const [url, label] of cases) {
      await page.goto(url);
      const chips = page.getByRole('list', { name: 'Active filters' });
      const chip = chips.getByRole('button', { name: `${label} ×` }).or(chips.getByRole('button', { name: label, exact: true }));
      await expect(chip, url).toBeVisible();
      await expect(page.getByRole('button', { name: 'Filters (1)' }), url).toBeVisible();
      await chip.click();
      await expect(page, url).toHaveURL(/\/$/);
      await expect(chips, url).toHaveCount(0);
    }
  });

  test('login, sell and account have page-specific titles', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle('Sign in — Alberta-Cars');
    const fs = require('node:fs');
    for (const [file, title] of [['app/sell/page.tsx', 'Sell your car — Alberta-Cars'], ['app/account/page.tsx', 'Account — Alberta-Cars'], ['app/listings/[id]/edit/page.tsx', 'Edit listing — Alberta-Cars']]) {
      expect(fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8'), file).toContain(`title: "${title}"`);
    }
  });
});
