import assert from "node:assert/strict";
import test from "node:test";
import { CAPTCHA_REQUIRED_MESSAGE, captchaRequired, isCaptchaFailure, turnstileSiteKey } from "../../lib/turnstile.ts";

test("site key is optional until the public env var is set", () => {
  const previous = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  try {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    assert.equal(turnstileSiteKey(), "");
    assert.equal(captchaRequired(), false);

    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "   ";
    assert.equal(captchaRequired(), false);

    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = " site-key ";
    assert.equal(turnstileSiteKey(), "site-key");
    assert.equal(captchaRequired(), true);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = previous;
  }
});

test("captcha failures use one generic message", () => {
  assert.equal(isCaptchaFailure({ message: "captcha protection: request disallowed" }), true);
  assert.equal(isCaptchaFailure({ code: "captcha_failed", message: "request disallowed" }), true);
  assert.equal(isCaptchaFailure({ message: "Invalid login credentials" }), false);
  assert.equal(isCaptchaFailure(null), false);
  assert.equal(CAPTCHA_REQUIRED_MESSAGE.includes("secret"), false);
});
