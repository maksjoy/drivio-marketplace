"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  bodyTypes,
  drivetrains,
  engineDisplacements,
  fuelTypes,
  transmissions,
  vehicleColors,
  vehicleFeatures,
  vehicleMakes,
  vehicleMakesAndModels,
  type VehicleMake,
} from "@/lib/listings";

const PRICE_MANUAL_MAX = 2000000;
const MILEAGE_MAX = 500000;

export function Filters({ cities }: { cities: readonly string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [advanced, setAdvanced] = useState(
    ["yearMin", "yearMax", "mileageMax", "fuel", "bodyType", "transmission", "drivetrain", "engineMin", "engineMax", "color", "feature"].some((key) => searchParams.has(key)),
  );

  const currentMake = (searchParams.get("make") ?? "") as VehicleMake | "";
  const models = currentMake && currentMake in vehicleMakesAndModels ? vehicleMakesAndModels[currentMake] : [];
  const activeFilters = Array.from(searchParams.keys()).filter((key) => key !== "sort").length;

  function update(key: string, value: string, extraDeletes: string[] = []) {
    const params = new URLSearchParams(searchParams.toString());
    const normalized = value.trim();
    if (normalized) params.set(key, normalized);
    else params.delete(key);
    for (const toDelete of extraDeletes) params.delete(toDelete);
    params.delete("page");
    params.delete("cursor");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  function updateMany(entries: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(entries)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    params.delete("cursor");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  function updateFeature(feature: string, checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    const selected = new Set(params.getAll("feature"));
    if (checked) selected.add(feature);
    else selected.delete(feature);
    params.delete("feature");
    for (const value of selected) params.append("feature", value);
    params.delete("page");
    params.delete("cursor");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  function reset() {
    router.push("/");
  }

  function showResults() {
    document.getElementById("marketplace-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="rounded-[24px] border border-line bg-white p-4 shadow-sm sm:p-5" aria-label="Vehicle search filters">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-body text-xl font-extrabold text-ink">Search cars</h2>
          <p className="mt-1 text-sm text-muted">Choose the main details. Results update as you filter.</p>
        </div>
        {activeFilters > 0 && (
          <button type="button" onClick={reset} className="flex-none text-sm font-semibold text-primary underline underline-offset-4">
            Clear
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FilterField label="Make" full>
          <select
            value={currentMake}
            onChange={(e) => update("make", e.target.value, ["model"])}
            className="h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-base font-semibold text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">All makes</option>
            {vehicleMakes.map((make) => <option key={make}>{make}</option>)}
          </select>
        </FilterField>

        <FilterField label="Model" full>
          <select
            value={searchParams.get("model") ?? ""}
            onChange={(e) => update("model", e.target.value)}
            disabled={!currentMake}
            className="h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-base font-semibold text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-surface-sunken disabled:text-muted"
          >
            <option value="">{currentMake ? "All models" : "Select make first"}</option>
            {models.map((model) => <option key={model}>{model}</option>)}
          </select>
        </FilterField>

        <FilterField label="Location">
          <select
            value={searchParams.get("city") ?? ""}
            onChange={(e) => update("city", e.target.value)}
            className="h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-base font-semibold text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">All Alberta</option>
            {cities.map((city) => <option key={city}>{city}</option>)}
          </select>
        </FilterField>

        <FilterField label="Fuel">
          <select
            value={searchParams.get("fuel") ?? ""}
            onChange={(e) => update("fuel", e.target.value)}
            className="h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-base font-semibold text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Any fuel</option>
            {fuelTypes.map((value) => <option key={value}>{value}</option>)}
          </select>
        </FilterField>
      </div>

      <PriceRange
        minValue={searchParams.get("priceMin") ?? ""}
        maxValue={searchParams.get("priceMax") ?? ""}
        onCommit={(min, max) => updateMany({ priceMin: min, priceMax: max })}
      />

      {advanced && (
        <div className="mt-4 rounded-2xl bg-surface-sunken p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-body text-sm font-extrabold uppercase tracking-wide text-ink-soft">More filters</h3>
            {activeFilters > 0 && <span className="text-xs font-semibold text-muted">{activeFilters} active</span>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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

            <FilterField label="Engine size from">
              <select value={searchParams.get("engineMin") ?? ""} onChange={(e) => update("engineMin", e.target.value)} className="h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-base font-semibold outline-none focus:border-primary">
                <option value="">Any minimum (L)</option>
                {engineDisplacements.map((value) => <option key={value} value={value}>{value} L</option>)}
              </select>
            </FilterField>
            <FilterField label="Engine size to">
              <select value={searchParams.get("engineMax") ?? ""} onChange={(e) => update("engineMax", e.target.value)} className="h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-base font-semibold outline-none focus:border-primary">
                <option value="">Any maximum (L)</option>
                {engineDisplacements.map((value) => <option key={value} value={value}>{value} L</option>)}
              </select>
            </FilterField>

            <FilterField label="Body type">
              <select value={searchParams.get("bodyType") ?? ""} onChange={(e) => update("bodyType", e.target.value)} className="h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-base font-semibold outline-none focus:border-primary">
                <option value="">Any body type</option>
                {bodyTypes.map((value) => <option key={value}>{value}</option>)}
              </select>
            </FilterField>

            <FilterField label="Transmission">
              <select value={searchParams.get("transmission") ?? ""} onChange={(e) => update("transmission", e.target.value)} className="h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-base font-semibold outline-none focus:border-primary">
                <option value="">Any transmission</option>
                {transmissions.map((value) => <option key={value}>{value}</option>)}
              </select>
            </FilterField>

            <FilterField label="Drivetrain">
              <select value={searchParams.get("drivetrain") ?? ""} onChange={(e) => update("drivetrain", e.target.value)} className="h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-base font-semibold outline-none focus:border-primary">
                <option value="">Any drivetrain</option>
                {drivetrains.map((value) => <option key={value}>{value}</option>)}
              </select>
            </FilterField>

            <FilterField label="Exterior colour">
              <select value={searchParams.get("color") ?? ""} onChange={(e) => update("color", e.target.value)} className="h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-base font-semibold outline-none focus:border-primary">
                <option value="">Any colour</option>
                {vehicleColors.map((value) => <option key={value}>{value}</option>)}
              </select>
            </FilterField>
          </div>

          <fieldset className="mt-4 rounded-xl border border-line bg-white p-3">
            <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted">Equipment and interior</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {vehicleFeatures.map((feature) => (
                <label key={feature} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm font-medium text-ink hover:bg-surface-sunken">
                  <input
                    type="checkbox"
                    checked={searchParams.getAll("feature").includes(feature)}
                    onChange={(event) => updateFeature(feature, event.target.checked)}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                  {feature}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={showResults}
          className="min-h-14 rounded-full bg-primary px-6 py-3 text-base font-extrabold text-white shadow-sm transition hover:bg-primary-strong active:scale-[0.99]"
        >
          View cars
        </button>
        <button
          type="button"
          onClick={() => setAdvanced((value) => !value)}
          aria-expanded={advanced}
          className="min-h-14 rounded-full border-2 border-ink bg-white px-6 py-3 text-base font-extrabold text-ink transition hover:bg-surface-sunken"
        >
          {advanced ? "Hide advanced filters" : "Advanced filters"}
        </button>
      </div>
    </section>
  );
}

function FilterField({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? "block sm:col-span-1" : "block"}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
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
  const [minDraft, setMinDraft] = useState(minValue);
  const [maxDraft, setMaxDraft] = useState(maxValue);

  useEffect(() => {
    setMinDraft(minValue);
    setMaxDraft(maxValue);
  }, [minValue, maxValue]);

  function commit() {
    const minNumber = Math.max(0, Number(minDraft) || 0);
    const maxNumber = Math.max(0, Number(maxDraft) || 0);

    const safeMin = minNumber ? String(Math.min(minNumber, PRICE_MANUAL_MAX)) : "";
    const safeMax = maxNumber ? String(Math.min(maxNumber, PRICE_MANUAL_MAX)) : "";

    if (safeMin && safeMax && Number(safeMin) > Number(safeMax)) {
      setMaxDraft(safeMin);
      onCommit(safeMin, safeMin);
      return;
    }

    setMinDraft(safeMin);
    setMaxDraft(safeMax);
    onCommit(safeMin, safeMax);
  }

  return (
    <div className="mt-4">
      <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Price</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex h-14 items-center rounded-xl border-2 border-line bg-white px-4 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <span className="mr-2 font-bold text-muted">$</span>
          <input
            aria-label="Minimum price"
            type="number"
            inputMode="numeric"
            min={0}
            max={PRICE_MANUAL_MAX}
            step={100}
            placeholder="Min"
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="min-w-0 w-full bg-transparent text-base font-semibold outline-none"
          />
        </label>

        <label className="flex h-14 items-center rounded-xl border-2 border-line bg-white px-4 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <span className="mr-2 font-bold text-muted">$</span>
          <input
            aria-label="Maximum price"
            type="number"
            inputMode="numeric"
            min={0}
            max={PRICE_MANUAL_MAX}
            step={100}
            placeholder="Max"
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="min-w-0 w-full bg-transparent text-base font-semibold outline-none"
          />
        </label>
      </div>
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
    <div className="rounded-xl border-2 border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-ink">{label}</span>
        <span className="font-semibold text-muted">{draft === max ? `${new Intl.NumberFormat("en-CA").format(max)}+${suffix}` : `${new Intl.NumberFormat("en-CA").format(draft)}${suffix}`}</span>
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
        className="w-full accent-primary"
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
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
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
        className="h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-base font-semibold outline-none focus:border-primary"
      />
    </label>
  );
}