import { z } from "zod";
import { CATALOG_PARAM_KEYS, CATALOG_PARAM_ORDER, sortCsvValue } from "./catalog-params";
import { decodeCursor, sortSchema, type CatalogSort } from "./catalog-cursor";
import {
  albertaCities,
  bodyTypes,
  COLORS,
  drivetrains,
  FEATURE_SLUGS,
  fuelTypes,
  transmissions,
  vehicleMakes,
  vehicleMakesAndModels,
  type VehicleMake,
} from "./listings";

const MAX_FEATURES = 12;
const ENGINE_LITRES = /^\d{1,2}(\.\d)?$/;
const makeValues = vehicleMakes as [VehicleMake, ...VehicleMake[]];

const csv = <const T extends readonly [string, ...string[]]>(values: T, max: number) =>
  z.string().max(400).transform((raw, ctx) => {
    const unique: Array<T[number]> = [];
    for (const part of raw.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const parsed = z.enum(values).safeParse(trimmed);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: "Invalid search filters." });
        return z.NEVER;
      }
      if (!unique.includes(parsed.data)) unique.push(parsed.data);
    }
    if (unique.length > max) {
      ctx.addIssue({ code: "custom", message: "Invalid search filters." });
      return z.NEVER;
    }
    const order = new Map<string, number>(values.map((value, index) => [value, index]));
    unique.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
    return unique;
  });

const boundedInt = (min: number, max: number) =>
  z.string().trim().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max));

const engineBound = z.string().trim().regex(ENGINE_LITRES).transform(Number).pipe(z.number().min(0.6).max(8.5));

const searchSchema = z.object({
  make: z.enum(makeValues).optional(),
  model: z.string().trim().min(1).max(60).optional(),
  city: z.enum(albertaCities).optional(),
  bodyType: csv(bodyTypes, bodyTypes.length).optional(),
  fuel: csv(fuelTypes, fuelTypes.length).optional(),
  drivetrain: csv(drivetrains, drivetrains.length).optional(),
  transmission: z.enum(transmissions).optional(),
  color: csv(COLORS, COLORS.length).optional(),
  features: csv(FEATURE_SLUGS, MAX_FEATURES).optional(),
  priceMin: boundedInt(0, 2_000_000).optional(),
  priceMax: boundedInt(0, 2_000_000).optional(),
  yearMin: boundedInt(1980, 2100).optional(),
  yearMax: boundedInt(1980, 2100).optional(),
  mileageMin: boundedInt(0, 2_000_000).optional(),
  mileageMax: boundedInt(0, 2_000_000).optional(),
  engineMin: engineBound.optional(),
  engineMax: engineBound.optional(),
  powerMin: boundedInt(40, 1500).optional(),
  powerMax: boundedInt(40, 1500).optional(),
  sort: sortSchema.optional(),
  cursor: z.string().min(1).max(200).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.model) {
    if (!value.make) {
      ctx.addIssue({ code: "custom", path: ["model"], message: "Invalid search filters." });
    } else {
      const models = vehicleMakesAndModels[value.make] as readonly string[];
      if (!models.includes(value.model)) ctx.addIssue({ code: "custom", path: ["model"], message: "Invalid search filters." });
    }
  }
  const pairs: Array<[number | undefined, number | undefined, string]> = [
    [value.priceMin, value.priceMax, "price"],
    [value.yearMin, value.yearMax, "year"],
    [value.mileageMin, value.mileageMax, "mileage"],
    [value.engineMin, value.engineMax, "engine"],
    [value.powerMin, value.powerMax, "power"],
  ];
  for (const [min, max] of pairs) {
    if (min !== undefined && max !== undefined && min > max) {
      ctx.addIssue({ code: "custom", message: "Invalid search filters." });
    }
  }
});

export type CatalogSearch = {
  make?: VehicleMake;
  model?: string;
  city?: (typeof albertaCities)[number];
  bodyType: string[];
  fuel: string[];
  drivetrain: string[];
  transmission?: (typeof transmissions)[number];
  color: string[];
  features: string[];
  priceMin?: number;
  priceMax?: number;
  yearMin?: number;
  yearMax?: number;
  mileageMin?: number;
  mileageMax?: number;
  engineMin?: number;
  engineMax?: number;
  powerMin?: number;
  powerMax?: number;
  sort: CatalogSort;
  cursor?: string;
};

export type CatalogSearchResult =
  | { ok: true; data: CatalogSearch; canonical: string }
  | { ok: false; status: number; message: string };

function formatBound(value: number | undefined, decimals: boolean) {
  if (value === undefined) return undefined;
  return decimals ? value.toFixed(1) : String(value);
}

export function canonicalCatalogQuery(data: CatalogSearch) {
  const params = new URLSearchParams();
  const entries: Array<[string, string | undefined]> = [
    ["make", data.make],
    ["model", data.model],
    ["city", data.city],
    ["priceMin", formatBound(data.priceMin, false)],
    ["priceMax", formatBound(data.priceMax, false)],
    ["yearMin", formatBound(data.yearMin, false)],
    ["yearMax", formatBound(data.yearMax, false)],
    ["mileageMin", formatBound(data.mileageMin, false)],
    ["mileageMax", formatBound(data.mileageMax, false)],
    ["bodyType", data.bodyType.length ? data.bodyType.join(",") : undefined],
    ["fuel", data.fuel.length ? data.fuel.join(",") : undefined],
    ["transmission", data.transmission],
    ["drivetrain", data.drivetrain.length ? data.drivetrain.join(",") : undefined],
    ["engineMin", formatBound(data.engineMin, true)],
    ["engineMax", formatBound(data.engineMax, true)],
    ["powerMin", formatBound(data.powerMin, false)],
    ["powerMax", formatBound(data.powerMax, false)],
    ["color", data.color.length ? data.color.join(",") : undefined],
    ["features", data.features.length ? data.features.join(",") : undefined],
    ["sort", data.sort === "recent" ? undefined : data.sort],
    ["cursor", data.cursor],
  ];
  for (const [key, value] of entries) {
    if (value) params.set(key, value);
  }
  const ordered = params.toString();
  const expectedOrder = CATALOG_PARAM_ORDER.filter((key) => params.has(key));
  if (expectedOrder.join() !== [...params.keys()].join()) {
    const resorted = new URLSearchParams();
    for (const key of expectedOrder) {
      const value = params.get(key);
      if (value) resorted.set(key, value);
    }
    return resorted.toString();
  }
  return ordered;
}

export function parseCatalogSearch(params: URLSearchParams): CatalogSearchResult {
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (!CATALOG_PARAM_KEYS.has(key) || seen.has(key)) {
      return { ok: false, status: 400, message: "Invalid search filters." };
    }
    seen.add(key);
  }

  const raw: Record<string, string> = {};
  for (const key of CATALOG_PARAM_ORDER) {
    const value = params.get(key);
    if (value === null) continue;
    if (!value.trim()) return { ok: false, status: 400, message: "Invalid search filters." };
    if (key === "bodyType" || key === "fuel" || key === "drivetrain" || key === "color" || key === "features") {
      raw[key] = sortCsvValue(key, value);
    } else {
      raw[key] = value.trim();
    }
  }

  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, message: "Invalid search filters." };

  const sort = parsed.data.sort ?? "recent";
  if (parsed.data.cursor && !decodeCursor(parsed.data.cursor, sort)) {
    return { ok: false, status: 400, message: "Invalid search filters." };
  }

  const data: CatalogSearch = {
    make: parsed.data.make,
    model: parsed.data.model,
    city: parsed.data.city,
    bodyType: parsed.data.bodyType ?? [],
    fuel: parsed.data.fuel ?? [],
    drivetrain: parsed.data.drivetrain ?? [],
    transmission: parsed.data.transmission,
    color: parsed.data.color ?? [],
    features: parsed.data.features ?? [],
    priceMin: parsed.data.priceMin,
    priceMax: parsed.data.priceMax,
    yearMin: parsed.data.yearMin,
    yearMax: parsed.data.yearMax,
    mileageMin: parsed.data.mileageMin,
    mileageMax: parsed.data.mileageMax,
    engineMin: parsed.data.engineMin,
    engineMax: parsed.data.engineMax,
    powerMin: parsed.data.powerMin,
    powerMax: parsed.data.powerMax,
    sort,
    cursor: parsed.data.cursor,
  };
  return { ok: true, data, canonical: canonicalCatalogQuery(data) };
}

type Filterable<T> = {
  eq: (column: "make" | "model" | "city" | "transmission", value: string) => T;
  in: (column: "body_type" | "fuel" | "drivetrain" | "color", values: string[]) => T;
  gte: (column: "price" | "year" | "mileage" | "engine_l" | "power_hp", value: number) => T;
  lte: (column: "price" | "year" | "mileage" | "engine_l" | "power_hp", value: number) => T;
  contains: (column: "features", values: string[]) => T;
};

export function applyCatalogFilters<T extends Filterable<T>>(query: T, filters: CatalogSearch): T {
  let next = query;
  if (filters.make) next = next.eq("make", filters.make);
  if (filters.model) next = next.eq("model", filters.model);
  if (filters.city) next = next.eq("city", filters.city);
  if (filters.transmission) next = next.eq("transmission", filters.transmission);
  if (filters.bodyType.length) next = next.in("body_type", filters.bodyType);
  if (filters.fuel.length) next = next.in("fuel", filters.fuel);
  if (filters.drivetrain.length) next = next.in("drivetrain", filters.drivetrain);
  if (filters.color.length) next = next.in("color", filters.color);
  if (filters.features.length) next = next.contains("features", filters.features);
  if (filters.priceMin !== undefined) next = next.gte("price", filters.priceMin);
  if (filters.priceMax !== undefined) next = next.lte("price", filters.priceMax);
  if (filters.yearMin !== undefined) next = next.gte("year", filters.yearMin);
  if (filters.yearMax !== undefined) next = next.lte("year", filters.yearMax);
  if (filters.mileageMin !== undefined) next = next.gte("mileage", filters.mileageMin);
  if (filters.mileageMax !== undefined) next = next.lte("mileage", filters.mileageMax);
  if (filters.engineMin !== undefined) next = next.gte("engine_l", filters.engineMin);
  if (filters.engineMax !== undefined) next = next.lte("engine_l", filters.engineMax);
  if (filters.powerMin !== undefined) next = next.gte("power_hp", filters.powerMin);
  if (filters.powerMax !== undefined) next = next.lte("power_hp", filters.powerMax);
  return next;
}

const SORT_ORDER = {
  recent: { column: "created_at", ascending: false },
  price_asc: { column: "price", ascending: true },
  price_desc: { column: "price", ascending: false },
  year_desc: { column: "year", ascending: false },
  year_asc: { column: "year", ascending: true },
  mileage_asc: { column: "mileage", ascending: true },
  mileage_desc: { column: "mileage", ascending: false },
} as const;

export function applyCatalogSort<T extends { order: (column: "created_at" | "price" | "year" | "mileage" | "id", options: { ascending: boolean }) => T }>(query: T, sort: CatalogSort): T {
  const spec = SORT_ORDER[sort];
  return query.order(spec.column, { ascending: spec.ascending }).order("id", { ascending: spec.ascending });
}
