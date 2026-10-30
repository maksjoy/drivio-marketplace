const { test, expect } = require('@playwright/test');

// Fails if the app itself triggers any CSP violation (inline <style>, style="" attributes,
// blocked frames/scripts) on the main public pages. CSP stays strict: style-src 'self', no 'unsafe-inline'.
//
// The Vercel Toolbar (https://vercel.live/_next-live/feedback/feedback.js) is injected by Vercel into
// the webpack runtime of Preview deployments (and of Production when the __vercel_toolbar=1 cookie is
// set). Its shadow-DOM <style> tags and vercel.live iframe are blocked by our CSP and show up as
// ~6 "Applying inline style violates ... style-src 'self'" console errors plus one frame error.
// That is Vercel tooling, not app code, so it is excluded here and must not be "fixed" by loosening CSP.
const TOOLBAR_ORIGIN = 'https://vercel.live';

function fromToolbar(value) {
  try {
    return new URL(String(value)).origin === TOOLBAR_ORIGIN;
  } catch {
    return false;
  }
}

async function collectViolations(page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      const target = event.target;
      window.__cspViolations.push({
        directive: event.violatedDirective,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile,
        line: event.lineNumber,
        sample: event.sample,
        element: target && target.outerHTML ? target.outerHTML.slice(0, 200) : String(target && target.nodeName),
      });
    }, true);
  });
}

async function readViolations(page) {
  const all = await page.evaluate(() => window.__cspViolations || []);
  return all.filter((v) => !fromToolbar(v.sourceFile) && !fromToolbar(v.blockedURI));
}

async function firstListingId(request) {
  const response = await request.get('/api/listings');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.listings.length).toBeGreaterThan(0);
  return payload.listings[0].id;
}

test('public pages render without CSP violations', async ({ page, request }) => {
  await collectViolations(page);
  const id = await firstListingId(request);

  for (const path of ['/', '/login', `/listings/${id}`, '/sell']) {
    const response = await page.goto(path, { waitUntil: 'networkidle' });
    expect(response && response.status(), path).toBeLessThan(400);
    const csp = response.headers()['content-security-policy'] || '';
    expect(csp, path).toContain("style-src 'self'");
    expect(csp, path).not.toContain("'unsafe-inline'");
    await page.waitForTimeout(1000);
    expect(await readViolations(page), `CSP violations on ${path}`).toEqual([]);
  }
  expect(page.url()).toMatch(/\/login/); // /sell redirects anonymous users to login
});
