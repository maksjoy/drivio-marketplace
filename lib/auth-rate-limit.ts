import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const RATE_LIMIT_MESSAGE = "Too many attempts. Please try again later.";

const FIFTEEN_MINUTES = "15 m" satisfies Duration;
const ONE_HOUR = "1 h" satisfies Duration;

export const AUTH_LIMITS = {
  signin: {
    ip: { tokens: 20, window: FIFTEEN_MINUTES },
    email: { tokens: 10, window: FIFTEEN_MINUTES },
  },
  signup: {
    ip: { tokens: 5, window: ONE_HOUR },
    email: { tokens: 3, window: ONE_HOUR },
  },
  recover: {
    ip: { tokens: 5, window: ONE_HOUR },
    email: { tokens: 3, window: ONE_HOUR },
  },
  update_password: {
    ip: { tokens: 10, window: ONE_HOUR },
  },
} as const;

export type AuthRateLimitAction = keyof typeof AUTH_LIMITS;

type RateLimitRedis = ConstructorParameters<typeof Ratelimit>[0]["redis"];

export type AuthRateLimitDecision =
  | { limited: false }
  | { limited: true; retryAfterSeconds: number };

type BucketResult = { success: boolean; reset: number };

const limiters = new WeakMap<object, Map<string, Ratelimit>>();
let redisClient: Redis | undefined;
let warnedMissingConfig = false;

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resetAuthRateLimitForTests(): void {
  warnedMissingConfig = false;
  redisClient = undefined;
}

function warnMissingConfig(): void {
  if (warnedMissingConfig) return;
  warnedMissingConfig = true;
  console.warn("Auth rate limiting is disabled because UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is unset.");
}

function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
  if (!url || !token) {
    warnMissingConfig();
    return null;
  }
  if (!redisClient) redisClient = new Redis({ url, token });
  return redisClient;
}

function limiterFor(redis: RateLimitRedis, action: AuthRateLimitAction, scope: "ip" | "email", tokens: number, window: Duration): Ratelimit {
  let cached = limiters.get(redis);
  if (!cached) {
    cached = new Map();
    limiters.set(redis, cached);
  }
  const key = `${action}:${scope}`;
  const existing = cached.get(key);
  if (existing) return existing;
  const created = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix: `albertacars:auth:${action}:${scope}`,
    analytics: false,
  });
  cached.set(key, created);
  return created;
}

function retryAfterSeconds(resetMs: number): number {
  if (!Number.isFinite(resetMs) || resetMs <= 0) return 60;
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
}

async function consume(redis: RateLimitRedis, action: AuthRateLimitAction, scope: "ip" | "email", identifier: string): Promise<BucketResult> {
  const limits = AUTH_LIMITS[action];
  const spec = scope === "ip" ? limits.ip : "email" in limits ? limits.email : undefined;
  if (!spec) return { success: true, reset: 0 };
  const result = await limiterFor(redis, action, scope, spec.tokens, spec.window).limit(identifier);
  return { success: result.success, reset: result.reset };
}

export async function enforceAuthRateLimit(input: {
  action: AuthRateLimitAction;
  ip: string;
  email?: string;
  redis?: RateLimitRedis | null;
}): Promise<AuthRateLimitDecision> {
  try {
    const redis = input.redis !== undefined ? input.redis : redisFromEnv();
    if (!redis) return { limited: false };

    const ip = input.ip.trim() || "unknown";
    const email = input.email ? normalizeAuthEmail(input.email) : "";
    const results = [await consume(redis, input.action, "ip", `ip:${ip}`)];
    if (input.action !== "update_password" && email.includes("@")) {
      results.push(await consume(redis, input.action, "email", `email:${email}`));
    }

    let retryAfter = 0;
    let limited = false;
    for (const result of results) {
      if (result.success) continue;
      limited = true;
      retryAfter = Math.max(retryAfter, retryAfterSeconds(result.reset));
    }
    if (!limited) return { limited: false };
    return { limited: true, retryAfterSeconds: retryAfter };
  } catch (error) {
    console.error("Auth rate limit check failed; allowing the attempt.", error);
    return { limited: false };
  }
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  const seconds = Math.max(1, Math.floor(retryAfterSeconds));
  return Response.json(
    { error: RATE_LIMIT_MESSAGE },
    {
      status: 429,
      headers: {
        "Retry-After": String(seconds),
        "Cache-Control": "private, no-store",
      },
    },
  );
}
