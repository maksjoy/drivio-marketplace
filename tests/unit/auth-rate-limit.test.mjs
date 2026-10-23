import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_LIMITS,
  RATE_LIMIT_MESSAGE,
  enforceAuthRateLimit,
  normalizeAuthEmail,
  rateLimitResponse,
  resetAuthRateLimitForTests,
} from "../../lib/auth-rate-limit.ts";

class MemoryRedis {
  constructor() {
    this.store = new Map();
  }

  read(key, now) {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= now) return 0;
    return entry.value;
  }

  async evalsha(_sha, keys, args) {
    const [currentKey, previousKey] = keys;
    const tokens = Number(args[0]);
    const now = Number(args[1]);
    const windowMs = Number(args[2]);
    const incrementBy = Number(args[3]);
    const current = this.read(currentKey, now);
    const previous = Math.floor((1 - ((now % windowMs) / windowMs)) * this.read(previousKey, now));
    if (incrementBy > 0 && previous + current >= tokens) return [-1, tokens];
    const next = current + incrementBy;
    const existing = this.store.get(currentKey);
    const expiresAt = existing && existing.expiresAt > now ? existing.expiresAt : now + windowMs * 2 + 1000;
    this.store.set(currentKey, { value: next, expiresAt });
    return [tokens - (next + previous), tokens];
  }

  async get() {
    return null;
  }

  async set() {
    return "OK";
  }
}

async function attempts(redis, action, count, extra = {}) {
  const decisions = [];
  for (let index = 0; index < count; index += 1) {
    decisions.push(await enforceAuthRateLimit({ action, ip: "203.0.113.10", redis, ...extra }));
  }
  return decisions;
}

test("normalizes email by trimming and lowercasing without removing aliases", () => {
  assert.equal(normalizeAuthEmail("  A@Example.com "), "a@example.com");
  assert.equal(normalizeAuthEmail("User+tag@Example.com"), "user+tag@example.com");
});

test("signin allows the configured IP and email budgets, then returns a generic retry", async () => {
  const redis = new MemoryRedis();
  const allowed = await attempts(redis, "signin", AUTH_LIMITS.signin.email.tokens, { email: "a@example.com" });
  assert.equal(allowed.every((decision) => decision.limited === false), true);

  const blocked = await enforceAuthRateLimit({
    action: "signin",
    ip: "203.0.113.20",
    email: " A@Example.com ",
    redis,
  });
  assert.equal(blocked.limited, true);
  assert.ok(blocked.retryAfterSeconds >= 1);
  assert.ok(blocked.retryAfterSeconds <= 15 * 60);

  const otherEmail = await enforceAuthRateLimit({
    action: "signin",
    ip: "203.0.113.20",
    email: "other@example.com",
    redis,
  });
  assert.equal(otherEmail.limited, false);
});

test("signin IP budget is shared across emails and is separate from signup", async () => {
  const redis = new MemoryRedis();
  const allowed = [];
  for (let index = 0; index < AUTH_LIMITS.signin.ip.tokens; index += 1) {
    allowed.push(await enforceAuthRateLimit({
      action: "signin",
      ip: "203.0.113.10",
      email: `person-${index}@example.com`,
      redis,
    }));
  }
  assert.equal(allowed.every((decision) => decision.limited === false), true);

  const blocked = await enforceAuthRateLimit({
    action: "signin",
    ip: "203.0.113.10",
    email: "fresh@example.com",
    redis,
  });
  assert.equal(blocked.limited, true);

  const signup = await enforceAuthRateLimit({
    action: "signup",
    ip: "203.0.113.10",
    email: "fresh@example.com",
    redis,
  });
  assert.equal(signup.limited, false);
});

test("signup and recover use the tighter hourly email budget", async () => {
  for (const action of ["signup", "recover"]) {
    const redis = new MemoryRedis();
    const allowed = await attempts(redis, action, AUTH_LIMITS[action].email.tokens, { email: "a@example.com" });
    assert.equal(allowed.every((decision) => decision.limited === false), true);
    const blocked = await enforceAuthRateLimit({ action, ip: "198.51.100.4", email: "a@example.com", redis });
    assert.equal(blocked.limited, true);
    assert.ok(blocked.retryAfterSeconds <= 60 * 60);
  }
});

test("an address without @ counts against IP only", async () => {
  const redis = new MemoryRedis();
  const pastEmailBudget = await attempts(redis, "signup", AUTH_LIMITS.signup.email.tokens + 1, { email: "not-an-email" });
  assert.equal(pastEmailBudget.every((decision) => decision.limited === false), true);

  const remainingIp = AUTH_LIMITS.signup.ip.tokens - pastEmailBudget.length;
  const rest = await attempts(redis, "signup", remainingIp, { email: "also-not-an-email" });
  assert.equal(rest.every((decision) => decision.limited === false), true);

  const blockedIp = await enforceAuthRateLimit({ action: "signup", ip: "203.0.113.10", email: "a@example.com", redis });
  assert.equal(blockedIp.limited, true);
});

test("password update is limited per IP and ignores email", async () => {
  const redis = new MemoryRedis();
  const allowed = await attempts(redis, "update_password", AUTH_LIMITS.update_password.ip.tokens, { email: "a@example.com" });
  assert.equal(allowed.every((decision) => decision.limited === false), true);
  const blocked = await enforceAuthRateLimit({
    action: "update_password",
    ip: "203.0.113.10",
    email: "other@example.com",
    redis,
  });
  assert.equal(blocked.limited, true);
});

test("missing Upstash credentials skip limiting and warn once", async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetAuthRateLimitForTests();
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    for (let index = 0; index < AUTH_LIMITS.signin.ip.tokens + 5; index += 1) {
      const decision = await enforceAuthRateLimit({ action: "signin", ip: "203.0.113.10", email: "a@example.com" });
      assert.equal(decision.limited, false);
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /UPSTASH_REDIS_REST_URL/);
  } finally {
    console.warn = originalWarn;
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
    resetAuthRateLimitForTests();
  }
});

test("a Redis failure allows the attempt", async () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    const redis = {
      async evalsha() {
        throw new Error("redis unavailable");
      },
      async get() {
        return null;
      },
      async set() {
        return "OK";
      },
    };
    const decision = await enforceAuthRateLimit({ action: "signin", ip: "203.0.113.10", email: "a@example.com", redis });
    assert.equal(decision.limited, false);
    assert.match(errors[0], /allowing the attempt/);
  } finally {
    console.error = originalError;
  }
});

test("429 response hides which bucket fired", async () => {
  const response = rateLimitResponse(90);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "90");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const body = await response.json();
  assert.deepEqual(body, { error: RATE_LIMIT_MESSAGE });
  assert.equal(RATE_LIMIT_MESSAGE.includes("email"), false);
  assert.equal(RATE_LIMIT_MESSAGE.includes("IP"), false);
  assert.equal(rateLimitResponse(0).headers.get("Retry-After"), "1");
});
