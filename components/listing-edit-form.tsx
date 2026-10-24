"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  albertaCities,
  bodyTypes,
  COLORS,
  drivetrains,
  engineLitreOptions,
  featureGroups,
  featureLabels,
  fuelTypes,
  transmissions,
  vehicleMakes,
  vehicleMakesAndModels,
  type FeatureSlug,
  type VehicleMake,
} from "@/lib/listings";

type ListingEditValues = {
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuel: string;
  bodyType: string | null;
  transmission: string | null;
  drivetrain: string | null;
  city: string | null;
  color: string | null;
  engineL: number | string | null;
  powerHp: number | null;
  features: string[];
  description: string | null;
};

export function ListingEditForm({ listingId, initial }: { listingId: string; initial: ListingEditValues }) {
  const router = useRouter();
  const [make, setMake] = useState(initial.make);
  const [model, setModel] = useState(initial.model);
  const [fuel, setFuel] = useState(initial.fuel);
  const [features, setFeatures] = useState<string[]>(initial.features);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const models = make in vehicleMakesAndModels ? vehicleMakesAndModels[make as VehicleMake] : [];
  const electric = fuel === "Electric";
  const engineValue = initial.engineL === null || initial.engineL === undefined || initial.engineL === ""
    ? ""
    : Number(initial.engineL).toFixed(1);

  function toggleFeature(slug: string, checked: boolean) {
    setFeatures((current) => checked ? [...current, slug] : current.filter((value) => value !== slug));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      make,
      model,
      year: form.get("year"),
      price: form.get("price"),
      mileage: form.get("mileage"),
      fuel,
      bodyType: form.get("bodyType") || undefined,
      transmission: form.get("transmission") || undefined,
      drivetrain: form.get("drivetrain") || undefined,
      city: form.get("city") || undefined,
      color: form.get("color") || undefined,
      engineL: electric ? undefined : form.get("engineL") || undefined,
      powerHp: form.get("powerHp") || undefined,
      description: form.get("description") || undefined,
      features,
    };
    try {
      const response = await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not update the listing.");
      setMessage("Submitted for review.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the listing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4 border-t border-prairie-200 pt-5">
      <div>
        <h2 className="text-lg font-extrabold">Edit listing</h2>
        <p className="text-sm text-prairie-600">Saving changes sends this listing back to review.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Make
          <select aria-label="Make" value={make} onChange={(event) => { setMake(event.target.value); setModel(""); }} className="input">
            {vehicleMakes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>Model
          <select aria-label="Model" value={model} onChange={(event) => setModel(event.target.value)} className="input">
            {models.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>Year<input aria-label="Year" name="year" type="number" min={1980} max={new Date().getFullYear() + 1} defaultValue={initial.year} required className="input" /></label>
        <label>Price (CAD)<input aria-label="Price (CAD)" name="price" type="number" min={500} max={2000000} defaultValue={initial.price} required className="input" /></label>
        <label>Mileage (km)<input aria-label="Mileage (km)" name="mileage" type="number" min={0} max={2000000} defaultValue={initial.mileage} required className="input" /></label>
        <label>Fuel
          <select aria-label="Fuel" value={fuel} onChange={(event) => setFuel(event.target.value)} className="input">
            {fuelTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Body type
          <select aria-label="Body type" name="bodyType" defaultValue={initial.bodyType ?? ""} className="input">
            <option value="">Body type</option>
            {bodyTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>City
          <select aria-label="City" name="city" defaultValue={initial.city ?? ""} className="input">
            <option value="">City</option>
            {albertaCities.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Transmission
          <select aria-label="Transmission" name="transmission" defaultValue={initial.transmission ?? ""} className="input">
            <option value="">Transmission</option>
            {transmissions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Drivetrain
          <select aria-label="Drivetrain" name="drivetrain" defaultValue={initial.drivetrain ?? ""} className="input">
            <option value="">Drivetrain</option>
            {drivetrains.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Colour
          <select aria-label="Colour" name="color" defaultValue={initial.color ?? ""} className="input">
            <option value="">Colour</option>
            {COLORS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        {!electric && (
          <label>Engine (L)
            <select aria-label="Engine (L)" name="engineL" defaultValue={engineValue} className="input">
              <option value="">Engine (L)</option>
              {engineLitreOptions().map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        )}
        <label>Power (hp)
          <input aria-label="Power (hp)" name="powerHp" type="number" min={40} max={1500} step={1} defaultValue={initial.powerHp ?? ""} className="input" />
        </label>
      </div>
      {featureGroups.map((group) => (
        <fieldset key={group.id}>
          <legend>{group.label}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.slugs.map((slug) => (
              <label key={slug} className="flex min-h-11 items-center gap-2">
                <input type="checkbox" checked={features.includes(slug)} onChange={(event) => toggleFeature(slug, event.target.checked)} />
                {featureLabels[slug as FeatureSlug]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <label>Description
        <textarea aria-label="Description" name="description" maxLength={3000} rows={5} defaultValue={initial.description ?? ""} className="input" />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      <button type="submit" disabled={saving} className="min-h-11">{saving ? "Saving…" : "Save and resubmit"}</button>
    </form>
  );
}
