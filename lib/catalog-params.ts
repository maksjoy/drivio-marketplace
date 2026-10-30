import {
  albertaCities,
  bodyTypes,
  COLORS,
  drivetrains,
  FEATURE_SLUGS,
  fuelTypes,
  transmissions,
  vehicleMakes,
} from "./listings";

export const CATALOG_QUERY_BYTE_LIMIT = 2048;

export const CATALOG_PARAM_ORDER = [
  "make",
  "model",
  "city",
  "priceMin",
  "priceMax",
  "yearMin",
  "yearMax",
  "mileageMin",
  "mileageMax",
  "bodyType",
  "fuel",
  "transmission",
  "drivetrain",
  "engineMin",
  "engineMax",
  "powerMin",
  "powerMax",
  "color",
  "features",
  "sort",
  "cursor",
] as const;

export const CATALOG_PARAM_KEYS = new Set<string>(CATALOG_PARAM_ORDER);

const CSV_ALLOWLISTS = {
  bodyType: bodyTypes,
  fuel: fuelTypes,
  drivetrain: drivetrains,
  color: COLORS,
  features: FEATURE_SLUGS,
} as const;

const SCALAR_ALLOWLISTS = {
  make: vehicleMakes,
  city: albertaCities,
  transmission: transmissions,
} as const;

export type CatalogParamKey = (typeof CATALOG_PARAM_ORDER)[number];

export function sortCsvValue(key: keyof typeof CSV_ALLOWLISTS, value: string) {
  const allowlist = CSV_ALLOWLISTS[key] as readonly string[];
  const order = new Map(allowlist.map((item, index) => [item, index]));
  const unique: string[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed || unique.includes(trimmed)) continue;
    unique.push(trimmed);
  }
  unique.sort((left, right) => (order.get(left) ?? Number.MAX_SAFE_INTEGER) - (order.get(right) ?? Number.MAX_SAFE_INTEGER));
  return unique.join(",");
}

/** Stable query string for browser URLs and the CDN cache key. Drops blanks, invalid ranges and the default sort. */
export function orderedCatalogQuery(input: URLSearchParams) {
  const params = normalizeCatalogRanges(input);
  const next = new URLSearchParams();
  for (const key of CATALOG_PARAM_ORDER) {
    if (key === "cursor") continue;
    const raw = params.get(key);
    if (!raw?.trim()) continue;
    if (key === "sort") {
      if (raw.trim() !== "recent") next.set("sort", raw.trim());
      continue;
    }
    if (key in CSV_ALLOWLISTS) {
      const sorted = sortCsvValue(key as keyof typeof CSV_ALLOWLISTS, raw);
      if (sorted) next.set(key, sorted);
      continue;
    }
    next.set(key, raw.trim());
  }
  return next.toString();
}

export function catalogQueryWithCursor(query: string, cursor: string) {
  const params = new URLSearchParams(query);
  params.set("cursor", cursor);
  return params.toString();
}

export function scalarAllowlist(key: keyof typeof SCALAR_ALLOWLISTS) {
  return SCALAR_ALLOWLISTS[key];
}

/**
 * Numeric range filters. The same bounds drive the inputs (min/max attributes), the client
 * URL normaliser and the server parser, so the page never asks the API for a range it rejects.
 */
export const CATALOG_RANGES = {
  price: { minKey: "priceMin", maxKey: "priceMax", min: 0, max: 2_000_000, decimals: 0 },
  year: { minKey: "yearMin", maxKey: "yearMax", min: 1980, max: 2100, decimals: 0 },
  mileage: { minKey: "mileageMin", maxKey: "mileageMax", min: 0, max: 2_000_000, decimals: 0 },
  engine: { minKey: "engineMin", maxKey: "engineMax", min: 0.6, max: 8.5, decimals: 1 },
  power: { minKey: "powerMin", maxKey: "powerMax", min: 40, max: 1500, decimals: 0 },
} as const;

export type CatalogRangeName = keyof typeof CATALOG_RANGES;
export type CatalogRange = (typeof CATALOG_RANGES)[CatalogRangeName];

const UNSIGNED_NUMBER = /^\d+(\.\d+)?$/;

/** One bound as typed or found in a URL: "" when blank, non-numeric or negative; otherwise rounded and clamped. */
export function normalizeRangeValue(range: CatalogRange, raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text || !UNSIGNED_NUMBER.test(text)) return "";
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return "";
  const rounded = range.decimals ? Math.round(parsed * 10) / 10 : Math.round(parsed);
  const clamped = Math.min(range.max, Math.max(range.min, rounded));
  return range.decimals ? clamped.toFixed(range.decimals) : String(clamped);
}

/** Both bounds of a range, normalised, with an inverted pair swapped. */
export function normalizeRangePair(range: CatalogRange, min: string | null | undefined, max: string | null | undefined): [string, string] {
  const low = normalizeRangeValue(range, min);
  const high = normalizeRangeValue(range, max);
  if (low && high && Number(low) > Number(high)) return [high, low];
  return [low, high];
}

/** Copy of params with every numeric range normalised (invalid bounds dropped, inverted pairs swapped). */
export function normalizeCatalogRanges(params: URLSearchParams) {
  const next = new URLSearchParams(params.toString());
  for (const range of Object.values(CATALOG_RANGES)) {
    if (!next.has(range.minKey) && !next.has(range.maxKey)) continue;
    const [low, high] = normalizeRangePair(range, next.get(range.minKey), next.get(range.maxKey));
    if (low) next.set(range.minKey, low);
    else next.delete(range.minKey);
    if (high) next.set(range.maxKey, high);
    else next.delete(range.maxKey);
  }
  return next;
}
