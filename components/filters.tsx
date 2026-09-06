"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  bodyTypes,
  drivetrains,
  fuelTypes,
  transmissions,
  vehicleMakes,
  vehicleMakesAndModels,
  type VehicleMake,
} from "@/lib/listings";

const PRICE_MAX = 200000;
const MILEAGE_MAX = 500000;

export function Filters({ cities }: { cities: readonly string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [advanced, setAdvanced] = useState(
    ["yearMin", "yearMax", "mileageMax", "fuel", "bodyType", "transmission", "drivetrain"].some((key) => searchParams.has(key)),
  );

  const currentMake = (searchParams.get("make") ?? "") as VehicleMake | "";
  const models = currentMake && currentMake in vehicleMakesAndModels ? vehicleMakesAndModels[currentMake] : [];

  function update(key: string, value: string, extraDeletes: string[] = []) {
    const params = new URLSearchParams(searchParams.toString());
    const normalized = value.trim();
    if (normalized) params.set(key, normalized);
    else params.delete(key);
    for (const toDelete of extraDeletes) params.delete(toDelete);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `/?${query}` : "/");
  }

  function updateMany(entries: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(entries)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `/?${query}` : "/");
  }

  function reset() {
    router.push("/");
  }

  return (
    <div className="rounded-2xl border border-prairie-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <select
          value={currentMake}
          onChange={(e) => update("make", e.target.value, ["model"])}
          className="filter-input"
        >
          <option value="">All makes</option>
          {vehicleMakes.map((make) => <option key={make}>{make}</option>)}
        </select>

        <select
          value={searchParams.get("model") ?? ""}
          onChange={(e) => update("model", e.target.value)}
          disabled={!currentMake}
          className="filter-input disabled:bg-prairie-100"
        >
          <option value="">All models</option>
          {models.map((model) => <option key={model}>{model}</option>)}
        </select>

        <select
          value={searchParams.get("city") ?? ""}
          onChange={(e) => update("city", e.target.value)}
          className="filter-input"
        >
          <option value="">All cities</option>
          {cities.map((city) => <option key={city}>{city}</option>)}
        </select>
      </div>

      <PriceRange
        minValue={searchParams.get("priceMin") ?? ""}
        maxValue={searchParams.get("priceMax") ?? ""}
        onCommit={(min, max) => updateMany({ priceMin: min, priceMax: max })}
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setAdvanced((value) => !value)} className="text-sm font-medium text-rig-700 underline">
          {advanced ? "Hide advanced filters" : "Advanced filters"}
        </button>
        {searchParams.toString() && (
          <button type="button" onClick={reset} className="text-sm text-prairie-600 hover:text-rig-700">
            Clear filters
          </button>
        )}
      </div>

      {advanced && (
        <div className="mt-4 grid gap-3 border-t border-prairie-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberFilter label="Year from" param="yearMin" value={searchParams.get("yearMin") ?? ""} update={update} />
          <NumberFilter label="Year to" param="yearMax" value={searchParams.get("yearMax") ?? ""} update={update} />

          <div className="sm:col-span-2">
            <RangeFilter
              label="Maximum mileage"
              value={searchParams.get("mileageMax") ?? ""}
              min={0}
              max={MILEAGE_MAX}
              step={5000}
              suffix=" km"
              onCommit={(value) => update("mileageMax", value === String(MILEAGE_MAX) ? "" : value)}
            />
          </div>

          <select value={searchParams.get("fuel") ?? ""} onChange={(e) => update("fuel", e.target.value)} className="filter-input">
            <option value="">Any fuel</option>
            {fuelTypes.map((value) => <option key={value}>{value}</option>)}
          </select>
          <select value={searchParams.get("bodyType") ?? ""} onChange={(e) => update("bodyType", e.target.value)} className="filter-input">
            <option value="">Any body type</option>
            {bodyTypes.map((value) => <option key={value}>{value}</option>)}
          </select>
          <select value={searchParams.get("transmission") ?? ""} onChange={(e) => update("transmission", e.target.value)} className="filter-input">
            <option value="">Any transmission</option>
            {transmissions.map((value) => <option key={value}>{value}</option>)}
          </select>
          <select value={searchParams.get("drivetrain") ?? ""} onChange={(e) => update("drivetrain", e.target.value)} className="filter-input">
            <option value="">Any drivetrain</option>
            {drivetrains.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function PriceRange({
  minValue,
  maxValue,
  onCommit,
}: {
  minValue: string;
  maxValue: string;
  onCommit: (min: string, max: string) => void;
}) {
  const parsedMin = Math.max(0, Math.min(PRICE_MAX, Number(minValue) || 0));
  const parsedMax = Math.max(parsedMin, Math.min(PRICE_MAX, Number(maxValue) || PRICE_MAX));
  const [minDraft, setMinDraft] = useState(parsedMin);
  const [maxDraft, setMaxDraft] = useState(parsedMax);

  useEffect(() => {
    setMinDraft(parsedMin);
    setMaxDraft(parsedMax);
  }, [parsedMin, parsedMax]);

  const minPct = useMemo(() => (minDraft / PRICE_MAX) * 100, [minDraft]);
  const maxPct = useMemo(() => (maxDraft / PRICE_MAX) * 100, [maxDraft]);

  function normalizeAndCommit(nextMin = minDraft, nextMax = maxDraft) {
    const safeMin = Math.max(0, Math.min(PRICE_MAX - 100, nextMin));
    const safeMax = Math.max(safeMin + 100, Math.min(PRICE_MAX, nextMax));
    setMinDraft(safeMin);
    setMaxDraft(safeMax);
    onCommit(
      safeMin === 0 ? "" : String(safeMin),
      safeMax === PRICE_MAX ? "" : String(safeMax),
    );
  }

  return (
    <div className="mt-4 rounded-xl border-2 border-prairie-300 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Price range</span>
        <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-600">
          {formatCompact(minDraft)} – {maxDraft === PRICE_MAX ? "$200k+" : formatCompact(maxDraft)}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-prairie-600">
          Min price
          <div className="mt-1 flex items-center rounded-lg border border-prairie-300 bg-white px-3">
            <span className="mr-1 text-prairie-500">$</span>
            <input
              aria-label="Minimum price exact value"
              type="number"
              min={0}
              max={PRICE_MAX - 100}
              step={100}
              value={minDraft}
              onChange={(e) => setMinDraft(Math.max(0, Number(e.target.value) || 0))}
              onBlur={() => normalizeAndCommit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="w-full bg-transparent py-2.5 outline-none"
            />
          </div>
        </label>

        <label className="text-xs font-semibold text-prairie-600">
          Max price
          <div className="mt-1 flex items-center rounded-lg border border-prairie-300 bg-white px-3">
            <span className="mr-1 text-prairie-500">$</span>
            <input
              aria-label="Maximum price exact value"
              type="number"
              min={100}
              max={PRICE_MAX}
              step={100}
              value={maxDraft}
              onChange={(e) => setMaxDraft(Math.min(PRICE_MAX, Number(e.target.value) || PRICE_MAX))}
              onBlur={() => normalizeAndCommit()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="w-full bg-transparent py-2.5 outline-none"
            />
          </div>
        </label>
      </div>

      <div className="relative h-10">
        <div className="absolute left-0 right-0 top-4 h-2 rounded-full bg-prairie-200" />
        <div
          className="absolute top-4 h-2 rounded-full bg-red-500"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        <input
          aria-label="Minimum price"
          type="range"
          min={0}
          max={PRICE_MAX}
          step={100}
          value={minDraft}
          onChange={(e) => setMinDraft(Math.min(Number(e.target.value), maxDraft - 100))}
          onMouseUp={() => normalizeAndCommit()}
          onTouchEnd={() => normalizeAndCommit()}
          className="pointer-events-none absolute inset-0 h-10 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-red-500 [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:shadow-md"
        />
        <input
          aria-label="Maximum price"
          type="range"
          min={0}
          max={PRICE_MAX}
          step={100}
          value={maxDraft}
          onChange={(e) => setMaxDraft(Math.max(Number(e.target.value), minDraft + 100))}
          onMouseUp={() => normalizeAndCommit()}
          onTouchEnd={() => normalizeAndCommit()}
          className="pointer-events-none absolute inset-0 h-10 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-red-500 [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:shadow-md"
        />
      </div>
      <p className="mt-1 text-xs text-prairie-500">Use the slider for a rough range or type an exact price, e.g. $3,500.</p>
    </div>
  );
}

function RangeFilter({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onCommit,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onCommit: (value: string) => void;
}) {
  const parsed = Math.max(min, Math.min(max, Number(value) || max));
  const [draft, setDraft] = useState(parsed);

  useEffect(() => setDraft(parsed), [parsed]);

  return (
    <div className="rounded-xl border border-prairie-200 bg-prairie-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-prairie-600">{draft === max ? `${new Intl.NumberFormat("en-CA").format(max)}+${suffix}` : `${new Intl.NumberFormat("en-CA").format(draft)}${suffix}`}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onMouseUp={() => onCommit(String(draft))}
        onTouchEnd={() => onCommit(String(draft))}
        className="w-full accent-rig-700"
      />
    </div>
  );
}

function NumberFilter({
  label,
  param,
  value,
  update,
}: {
  label: string;
  param: string;
  value: string;
  update: (key: string, value: string, extraDeletes?: string[]) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  return (
    <input
      aria-label={label}
      placeholder={label}
      type="number"
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => update(param, draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="filter-input"
    />
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
