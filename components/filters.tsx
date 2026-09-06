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

  function reset() {
    router.push("/");
  }

  return (
    <div className="rounded-2xl border border-prairie-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

        <NumberFilter label="Min price" param="priceMin" value={searchParams.get("priceMin") ?? ""} update={update} />
        <NumberFilter label="Max price" param="priceMax" value={searchParams.get("priceMax") ?? ""} update={update} />
      </div>

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
          <NumberFilter label="Max mileage" param="mileageMax" value={searchParams.get("mileageMax") ?? ""} update={update} />
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
