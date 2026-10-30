"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CATALOG_RANGES, canonicalCatalogParams, orderedCatalogQuery, type CatalogRange, type CatalogRangeName } from "@/lib/catalog-params";
import {
  albertaCities,
  bodyTypes,
  COLORS,
  drivetrains,
  featureGroups,
  featureLabels,
  fuelTypes,
  transmissions,
  vehicleMakes,
  vehicleMakesAndModels,
  type VehicleMake,
} from "@/lib/listings";

export type FilterOption = { value: string; label: string; count?: number };

export type ChoiceField = {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
};

export type MultiChoiceField = {
  value: string[];
  onChange: (value: string[]) => void;
  options: FilterOption[];
};

/** "push" adds a Back/Forward step; "replace" rewrites the current entry (used while typing). */
export type HistoryMode = "push" | "replace";

export type RangeField = {
  min: string;
  max: string;
  bounds: CatalogRange;
  onChange: (min: string, max: string, mode?: HistoryMode) => void;
};

type Chip = { id: string; label: string; onRemove: () => void };

type CatalogFilterContextValue = {
  make: ChoiceField;
  model: ChoiceField;
  city: ChoiceField;
  transmission: ChoiceField;
  bodyType: MultiChoiceField;
  fuel: MultiChoiceField;
  drivetrain: MultiChoiceField;
  color: MultiChoiceField;
  features: MultiChoiceField;
  price: RangeField;
  year: RangeField;
  mileage: RangeField;
  engine: RangeField;
  power: RangeField;
  awdOr4wd: { value: boolean; onChange: (checked: boolean) => void };
  sort: string;
  setSort: (value: string) => void;
  chips: Chip[];
  activeCount: number;
  clearAll: () => void;
  queryString: string;
  update: (key: string, value: string, extraDeletes?: string[]) => void;
  updateMany: (entries: Record<string, string>, mode?: HistoryMode) => void;
};

const CatalogFilterContext = createContext<CatalogFilterContextValue | null>(null);

function optionsFrom(values: readonly string[], labels?: Record<string, string>): FilterOption[] {
  return values.map((value) => ({ value, label: labels?.[value] ?? value }));
}

function listValue(params: URLSearchParams, key: string) {
  return (params.get(key) ?? "").split(",").map((part) => part.trim()).filter(Boolean);
}

function formatNumber(value: string) {
  return new Intl.NumberFormat("en-CA").format(Number(value));
}

function formatMoney(value: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(Number(value));
}

export function CatalogFilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const rawSearchParams = useSearchParams();
  const rawQuery = rawSearchParams.toString();
  // Hand-edited or stale URLs (?priceMin=abc, ?mileageMin=-5, ?yearMin=2020&yearMax=2010,
  // ?transmission=cvt) are normalised before anything reads them, so chips, inputs and the API request all agree.
  const searchParams = useMemo(() => canonicalCatalogParams(new URLSearchParams(rawQuery)), [rawQuery]);
  const normalizedQuery = searchParams.toString();

  useEffect(() => {
    if (normalizedQuery === rawQuery) return;
    router.replace(normalizedQuery ? `/?${normalizedQuery}` : "/", { scroll: false });
  }, [normalizedQuery, rawQuery, router]);

  function commit(params: URLSearchParams, mode: HistoryMode = "push") {
    params.delete("page");
    params.delete("cursor");
    const query = orderedCatalogQuery(params);
    const current = new URLSearchParams(rawQuery);
    current.delete("page");
    current.delete("cursor");
    if (current.toString() === query) return;
    const href = query ? `/?${query}` : "/";
    // Discrete changes get their own history entry so Back/Forward step through filter states.
    if (mode === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }

  function update(key: string, value: string, extraDeletes: string[] = []) {
    const params = new URLSearchParams(searchParams.toString());
    const normalized = value.trim();
    if (normalized) params.set(key, normalized);
    else params.delete(key);
    for (const extra of extraDeletes) params.delete(extra);
    commit(params);
  }

  function updateMany(entries: Record<string, string>, mode: HistoryMode = "push") {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(entries)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    commit(params, mode);
  }

  function range(bounds: CatalogRange): RangeField {
    return {
      min: searchParams.get(bounds.minKey) ?? "",
      max: searchParams.get(bounds.maxKey) ?? "",
      bounds,
      // orderedCatalogQuery normalises the pair (drops invalid bounds, swaps an inverted pair).
      onChange: (min, max, mode = "push") => updateMany({ [bounds.minKey]: min.trim(), [bounds.maxKey]: max.trim() }, mode),
    };
  }

  const makeValue = searchParams.get("make") ?? "";
  const models = makeValue in vehicleMakesAndModels ? vehicleMakesAndModels[makeValue as VehicleMake] : [];
  const drivetrainValue = listValue(searchParams, "drivetrain");

  const value = useMemo<CatalogFilterContextValue>(() => {
    const params = new URLSearchParams(searchParams.toString());
    const featureOptions = optionsFrom(
      featureGroups.flatMap((group) => group.slugs),
      featureLabels,
    );

    const chips: Chip[] = [];
    const addSingle = (key: string, label: string) => {
      const current = params.get(key);
      if (!current) return;
      chips.push({
        id: key,
        label,
        onRemove: () => update(key, ""),
      });
    };
    if (params.get("make")) addSingle("make", params.get("make") ?? "");
    if (params.get("model")) addSingle("model", params.get("model") ?? "");
    if (params.get("city")) addSingle("city", params.get("city") ?? "");
    if (params.get("transmission")) addSingle("transmission", params.get("transmission") ?? "");

    const addRange = (id: string, minKey: string, maxKey: string, labelFor: (min: string, max: string) => string) => {
      const min = params.get(minKey) ?? "";
      const max = params.get(maxKey) ?? "";
      if (!min && !max) return;
      // A lower bound at the range floor (?priceMin=0&priceMax=30000) filters nothing, so the
      // chip reads one-sided ("Up to $30,000") rather than "$0–$30,000".
      const floor = CATALOG_RANGES[id as CatalogRangeName]?.min;
      const shownMin = min && max && floor !== undefined && Number(min) <= floor ? "" : min;
      chips.push({
        id,
        label: labelFor(shownMin, max),
        onRemove: () => updateMany({ [minKey]: "", [maxKey]: "" }),
      });
    };
    addRange("price", "priceMin", "priceMax", (min, max) => min && max ? `${formatMoney(min)}–${formatMoney(max)}` : min ? `From ${formatMoney(min)}` : `Up to ${formatMoney(max)}`);
    addRange("year", "yearMin", "yearMax", (min, max) => min && max ? `${min}–${max}` : min ? `From ${min}` : `Up to ${max}`);
    addRange("mileage", "mileageMin", "mileageMax", (min, max) => {
      const text = (amount: string) => `${formatNumber(amount)} km`;
      return min && max ? `${text(min)}–${text(max)}` : min ? `From ${text(min)}` : `Up to ${text(max)}`;
    });
    addRange("engine", "engineMin", "engineMax", (min, max) => min && max ? `${min}–${max} L` : min ? `From ${min} L` : `Up to ${max} L`);
    addRange("power", "powerMin", "powerMax", (min, max) => min && max ? `${formatNumber(min)}–${formatNumber(max)} hp` : min ? `From ${formatNumber(min)} hp` : `Up to ${formatNumber(max)} hp`);

    const addMulti = (key: string, labels?: Record<string, string>) => {
      for (const item of listValue(params, key)) {
        chips.push({
          id: `${key}:${item}`,
          label: labels?.[item] ?? item,
          onRemove: () => update(key, listValue(params, key).filter((value) => value !== item).join(",")),
        });
      }
    };
    addMulti("bodyType");
    addMulti("fuel");
    addMulti("drivetrain");
    addMulti("color");
    addMulti("features", featureLabels);

    const multi = (key: string, choices: readonly string[], labels?: Record<string, string>): MultiChoiceField => ({
      value: listValue(params, key),
      onChange: (next) => update(key, next.join(",")),
      options: optionsFrom(choices, labels),
    });

    return {
      make: {
        value: makeValue,
        onChange: (next) => update("make", next, ["model"]),
        options: optionsFrom(vehicleMakes),
      },
      model: {
        value: params.get("model") ?? "",
        onChange: (next) => update("model", next),
        options: optionsFrom(models),
      },
      city: {
        value: params.get("city") ?? "",
        onChange: (next) => update("city", next),
        options: optionsFrom(albertaCities),
      },
      transmission: {
        value: params.get("transmission") ?? "",
        onChange: (next) => update("transmission", next),
        options: optionsFrom(transmissions),
      },
      bodyType: multi("bodyType", bodyTypes),
      fuel: multi("fuel", fuelTypes),
      drivetrain: multi("drivetrain", drivetrains),
      color: multi("color", COLORS),
      features: multi("features", featureOptions.map((option) => option.value), featureLabels),
      price: range(CATALOG_RANGES.price),
      year: range(CATALOG_RANGES.year),
      mileage: range(CATALOG_RANGES.mileage),
      engine: range(CATALOG_RANGES.engine),
      power: range(CATALOG_RANGES.power),
      awdOr4wd: {
        value: drivetrainValue.includes("AWD") && drivetrainValue.includes("4WD"),
        onChange: (checked) => {
          const next = new Set(drivetrainValue);
          if (checked) {
            next.add("AWD");
            next.add("4WD");
          } else {
            next.delete("AWD");
            next.delete("4WD");
          }
          update("drivetrain", drivetrains.filter((item) => next.has(item)).join(","));
        },
      },
      sort: params.get("sort") || "recent",
      setSort: (next) => update("sort", next === "recent" ? "" : next),
      chips,
      activeCount: chips.length,
      clearAll: () => {
        const next = new URLSearchParams();
        const sort = params.get("sort");
        if (sort && sort !== "recent") next.set("sort", sort);
        commit(next);
      },
      queryString: orderedCatalogQuery(params),
      update,
      updateMany,
    };
    // searchParams identity changes when the URL changes, which is the state source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return <CatalogFilterContext.Provider value={value}>{children}</CatalogFilterContext.Provider>;
}

export function useCatalogFilters() {
  const value = useContext(CatalogFilterContext);
  if (!value) throw new Error("useCatalogFilters must be used within CatalogFilterProvider");
  return value;
}
