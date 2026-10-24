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

/** Stable query string for browser URLs and the CDN cache key. Drops blanks and the default sort. */
export function orderedCatalogQuery(params: URLSearchParams) {
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
