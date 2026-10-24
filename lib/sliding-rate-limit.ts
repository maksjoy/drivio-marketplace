import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const RATE_LIMIT_MESSAGE = "Too many attempts. Please try again later.";

/** Separate from the auth limiter prefix in Security PR #25. */
export const CATALOG_RATE_PREFIX = "albertacars:catalog:ip";
export const LISTINGS_GET_RATE_PREFIX = "albertacars:listings:ip";
export const LISTING_PATCH_RATE_PREFIX = "albertacars:listing-patch:user";

export const CATALOG_RATE_LIMIT = { tokens: 60, window: "1 m" } as const;
export const LISTING_PATCH_RATE_LIMIT = { tokens: 20, window: "15 m" } as const;

type RateLimitRedis = ConstructorParameters<typeof Ratelimit>[0]["redis"];

export type SlidingRateLimitDecision =
  | { limited: false }
  | { limited: true; retryAfterSeconds: number };

const limiters = new WeakMap<object, Map<string, Ratelimit>>();
let redisClient: Redis | undefined;
let warnedMissingConfig = false;

export function resetSlidingRateLimitForTests(): void {
  warnedMissingConfig = false;
  redisClient = undefined;
}

function warnMissingConfig(): void {
  if (warnedMissingConfig) return;
  warnedMissingConfig = true;
  console.warn("Rate limiting is disabled because UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is unset.");
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

function limiterFor(redis: RateLimitRedis, prefix: string, tokens: number, window: Duration): Ratelimit {
  let cached = limiters.get(redis);
  if (!cached) {
    cached = new Map();
    limiters.set(redis, cached);
  }
  const key = `${prefix}:${tokens}:${window}`;
  const existing = cached.get(key);
  if (existing) return existing;
  const created = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix,
    analytics: false,
  });
  cached.set(key, created);
  return created;
}

function retryAfterSeconds(resetMs: number): number {
  if (!Number.isFinite(resetMs) || resetMs <= 0) return 60;
  return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
}

export async function enforceSlidingRateLimit(input: {
  prefix: string;
  identifier: string;
  tokens: number;
  window: Duration;
  redis?: RateLimitRedis | null;
}): Promise<SlidingRateLimitDecision> {
  try {
    if (!input.prefix.startsWith("albertacars:") || input.prefix.startsWith("albertacars:auth:")) {
      throw new Error("Refusing to share the auth rate-limit prefix.");
    }
    const redis = input.redis !== undefined ? input.redis : redisFromEnv();
    if (!redis) return { limited: false };
    const identifier = input.identifier.trim() || "unknown";
    const result = await limiterFor(redis, input.prefix, input.tokens, input.window).limit(identifier);
    if (result.success) return { limited: false };
    return { limited: true, retryAfterSeconds: retryAfterSeconds(result.reset) };
  } catch (error) {
    console.error("Rate limit check failed; allowing the request.", error);
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
