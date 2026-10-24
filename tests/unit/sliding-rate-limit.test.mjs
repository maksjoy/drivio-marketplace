import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOG_RATE_PREFIX,
  LISTING_PATCH_RATE_PREFIX,
  LISTINGS_GET_RATE_PREFIX,
  enforceSlidingRateLimit,
  resetSlidingRateLimitForTests,
} from "../../lib/sliding-rate-limit.ts";

test("catalog prefixes stay off the auth limiter", () => {
  for (const prefix of [CATALOG_RATE_PREFIX, LISTINGS_GET_RATE_PREFIX, LISTING_PATCH_RATE_PREFIX]) {
    assert.equal(prefix.startsWith("albertacars:"), true);
    assert.equal(prefix.startsWith("albertacars:auth:"), false);
  }
  assert.equal(CATALOG_RATE_PREFIX, "albertacars:catalog:ip");
  assert.equal(LISTINGS_GET_RATE_PREFIX, "albertacars:listings:ip");
  assert.equal(LISTING_PATCH_RATE_PREFIX, "albertacars:listing-patch:user");
});

test("missing redis and thrown checks fail open", async () => {
  resetSlidingRateLimitForTests();
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const missing = await enforceSlidingRateLimit({
      prefix: CATALOG_RATE_PREFIX,
      identifier: "203.0.113.10",
      tokens: 60,
      window: "1 m",
    });
    assert.deepEqual(missing, { limited: false });

    const explicit = await enforceSlidingRateLimit({
      prefix: LISTINGS_GET_RATE_PREFIX,
      identifier: "203.0.113.10",
      tokens: 60,
      window: "1 m",
      redis: null,
    });
    assert.deepEqual(explicit, { limited: false });

    const authPrefix = await enforceSlidingRateLimit({
      prefix: "albertacars:auth:ip",
      identifier: "203.0.113.10",
      tokens: 60,
      window: "1 m",
      redis: null,
    });
    assert.deepEqual(authPrefix, { limited: false });

    const thrown = await enforceSlidingRateLimit({
      prefix: LISTING_PATCH_RATE_PREFIX,
      identifier: "user-1",
      tokens: 20,
      window: "15 m",
      redis: { get: () => { throw new Error("redis down"); } },
    });
    assert.deepEqual(thrown, { limited: false });
  } finally {
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
    resetSlidingRateLimitForTests();
  }
});
