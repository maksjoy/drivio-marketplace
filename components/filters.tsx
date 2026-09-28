"use client";

import { useEffect, useState } from "react";
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

const PRICE_MANUAL_MAX = 2000000;
const MILEAGE_MAX = 500000;

export function Filters({ cities }: { cities: readonly string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [advanced, setAdvanced] = useState(
    ["yearMax", "mileageMax", "bodyType", "drivetrain"].some((key) => searchParams.has(key)),
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

  function reset() {
    router.push("/");
  }

  function showResults() {
    document.getElementById("marketplace-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const fieldClass = "h-[58px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-rig-700 focus:ring-2 focus:ring-rig-700/10 disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <section className="bg-white sm:rounded-[24px] sm:border sm:border-slate-200 sm:p-5 sm:shadow-sm" aria-label="Vehicle search filters">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">Find your next car in Alberta</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Private sellers only</p>
        </div>
        {activeFilters > 0 && (
          <button type="button" onClick={reset} className="flex-none pb-1 text-sm font-bold text-rig-700 underline underline-offset-4">
            Clear
          </button>
        )}
      </div>

      <div className="grid gap-3">
        <label className="block">
          <span className="sr-only">Make</span>
          <select value={currentMake} onChange={(e) => update("make", e.target.value, ["model"])} className={fieldClass} aria-label="Make">
            <option value="">Make</option>
            {vehicleMakes.map((make) => <option key={make}>{make}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Model</span>
          <select value={searchParams.get("model") ?? ""} onChange={(e) => update("model", e.target.value)} disabled={!currentMake} className={fieldClass} aria-label="Model">
            <option value="">{currentMake ? "Model" : "Select make first"}</option>
            {models.map((model) => <option key={model}>{model}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <NumberFilter label="Year from" placeholder="Year" param="yearMin" value={searchParams.get("yearMin") ?? ""} update={update} />
          <PriceMax value={searchParams.get("priceMax") ?? ""} onCommit={(value) => update("priceMax", value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="sr-only">Location</span>
            <select value={searchParams.get("city") ?? ""} onChange={(e) => update("city", e.target.value)} className={fieldClass} aria-label="Location">
              <option value="">Location</option>
              {cities.map((city) => <option key={city}>{city}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="sr-only">Fuel</span>
            <select value={searchParams.get("fuel") ?? ""} onChange={(e) => update("fuel", e.target.value)} className={fieldClass} aria-label="Fuel">
              <option value="">Fuel</option>
              {fuelTypes.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="sr-only">Transmission</span>
          <select value={searchParams.get("transmission") ?? ""} onChange={(e) => update("transmission", e.target.value)} className={fieldClass} aria-label="Transmission">
            <option value="">Transmission</option>
            {transmissions.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>

      {advanced && (
        <div className="mt-3 rounded-2xl bg-slate-50 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">More filters</h2>
            {activeFilters > 0 && <span className="text-xs font-semibold text-slate-500">{activeFilters} active</span>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberFilter label="Year to" placeholder="Year to" param="yearMax" value={searchParams.get("yearMax") ?? ""} update={update} />
            <PriceMin value={searchParams.get("priceMin") ?? ""} onCommit={(value) => update("priceMin", value)} />

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

            <label className="block">
              <span className="sr-only">Body type</span>
              <select value={searchParams.get("bodyType") ?? ""} onChange={(e) => update("bodyType", e.target.value)} className={fieldClass} aria-label="Body type">
                <option value="">Body type</option>
                {bodyTypes.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="sr-only">Drivetrain</span>
              <select value={searchParams.get("drivetrain") ?? ""} onChange={(e) => update("drivetrain", e.target.value)} className={fieldClass} aria-label="Drivetrain">
                <option value="">Drivetrain</option>
                {drivetrains.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <button type="button" onClick={showResults} className="min-h-[58px] w-full rounded-full bg-wildrose-600 px-6 py-3 text-base font-extrabold text-white shadow-sm transition hover:bg-wildrose-700 active:scale-[0.99]">
          Search cars
        </button>
        <button type="button" onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced} aria-label="Advanced filters" className="min-h-[58px] w-full rounded-full border-2 border-slate-900 bg-white px-6 py-3 text-base font-extrabold text-slate-900 transition hover:bg-slate-50">
          {advanced ? "Hide advanced search" : "Advanced search"}
        </button>
      </div>
    </section>
  );
}

function PriceMax({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  return <MoneyInput label="Maximum price" placeholder="Max price" value={value} onCommit={onCommit} />;
}

function PriceMin({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  return <MoneyInput label="Minimum price" placeholder="Min price" value={value} onCommit={onCommit} />;
}

function MoneyInput({ label, placeholder, value, onCommit }: { label: string; placeholder: string; value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  function commit() {
    const number = Math.max(0, Number(draft) || 0);
    const safe = number ? String(Math.min(number, PRICE_MANUAL_MAX)) : "";
    setDraft(safe);
    onCommit(safe);
  }

  return (
    <label className="flex h-[58px] items-center rounded-2xl border-2 border-slate-200 bg-white px-4 transition focus-within:border-rig-700 focus-within:ring-2 focus-within:ring-rig-700/10">
      <span className="mr-1 font-bold text-slate-500">$</span>
      <input aria-label={label} type="number" inputMode="numeric" min={0} max={PRICE_MANUAL_MAX} step={100} placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} className="min-w-0 w-full bg-transparent text-base font-semibold outline-none placeholder:text-slate-500" />
    </label>
  );
}

function RangeFilter({ label, value, min, max, step, suffix, onCommit }: { label: string; value: string; min: number; max: number; step: number; suffix: string; onCommit: (value: string) => void }) {
  const parsed = Math.max(min, Math.min(max, Number(value) || max));
  const [draft, setDraft] = useState(parsed);
  useEffect(() => setDraft(parsed), [parsed]);

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-slate-800">{label}</span>
        <span className="font-semibold text-slate-600">{draft === max ? `${new Intl.NumberFormat("en-CA").format(max)}+${suffix}` : `${new Intl.NumberFormat("en-CA").format(draft)}${suffix}`}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={draft} onChange={(e) => setDraft(Number(e.target.value))} onMouseUp={() => onCommit(String(draft))} onTouchEnd={() => onCommit(String(draft))} className="w-full accent-rig-700" />
    </div>
  );
}

function NumberFilter({ label, placeholder, param, value, update }: { label: string; placeholder: string; param: string; value: string; update: (key: string, value: string, extraDeletes?: string[]) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input aria-label={label} placeholder={placeholder} type="number" inputMode="numeric" min="0" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => update(param, draft)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} className="h-[58px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base font-semibold outline-none placeholder:text-slate-500 focus:border-rig-700 focus:ring-2 focus:ring-rig-700/10" />
    </label>
  );
}
