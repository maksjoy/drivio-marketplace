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
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { buttonClasses } from "@/components/ui/button";

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
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div>
        <h2 className="font-body text-lg font-extrabold text-ink">Edit listing</h2>
        <p className="text-sm text-muted">Saving changes sends this listing back to review.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Make">
          <select aria-label="Make" value={make} onChange={(event) => { setMake(event.target.value); setModel(""); }} className="input min-h-11">
            {vehicleMakes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Model">
          <select aria-label="Model" value={model} onChange={(event) => setModel(event.target.value)} className="input min-h-11">
            {models.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Year"><input aria-label="Year" name="year" type="number" min={1980} max={new Date().getFullYear() + 1} defaultValue={initial.year} required className="input min-h-11" /></Field>
        <Field label="Price (CAD)"><input aria-label="Price (CAD)" name="price" type="number" min={500} max={2000000} defaultValue={initial.price} required className="input min-h-11" /></Field>
        <Field label="Mileage (km)"><input aria-label="Mileage (km)" name="mileage" type="number" min={0} max={2000000} defaultValue={initial.mileage} required className="input min-h-11" /></Field>
        <Field label="Fuel">
          <select aria-label="Fuel" value={fuel} onChange={(event) => setFuel(event.target.value)} className="input min-h-11">
            {fuelTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Body type">
          <select aria-label="Body type" name="bodyType" defaultValue={initial.bodyType ?? ""} className="input min-h-11">
            <option value="">Body type</option>
            {bodyTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="City">
          <select aria-label="City" name="city" defaultValue={initial.city ?? ""} className="input min-h-11">
            <option value="">City</option>
            {albertaCities.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Transmission">
          <select aria-label="Transmission" name="transmission" defaultValue={initial.transmission ?? ""} className="input min-h-11">
            <option value="">Transmission</option>
            {transmissions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Drivetrain">
          <select aria-label="Drivetrain" name="drivetrain" defaultValue={initial.drivetrain ?? ""} className="input min-h-11">
            <option value="">Drivetrain</option>
            {drivetrains.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Colour">
          <select aria-label="Colour" name="color" defaultValue={initial.color ?? ""} className="input min-h-11">
            <option value="">Colour</option>
            {COLORS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        {!electric && (
          <Field label="Engine (L)">
            <select aria-label="Engine (L)" name="engineL" defaultValue={engineValue} className="input min-h-11">
              <option value="">Select</option>
              {engineLitreOptions().map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
        )}
        <Field label="Power (hp)">
          <div className="relative">
            <input aria-label="Power (hp)" name="powerHp" type="number" inputMode="numeric" min={40} max={1500} step={1} placeholder="180" defaultValue={initial.powerHp ?? ""} className="input min-h-11 pr-12" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-normal text-muted">hp</span>
          </div>
        </Field>
      </div>
      {featureGroups.map((group) => (
        <fieldset key={group.id} className="rounded-control border border-line p-3">
          <legend className="px-1 text-sm font-medium text-ink">{group.label}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.slugs.map((slug) => (
              <label key={slug} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-primary" checked={features.includes(slug)} onChange={(event) => toggleFeature(slug, event.target.checked)} />
                {featureLabels[slug as FeatureSlug]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <Field label="Description">
        <textarea aria-label="Description" name="description" maxLength={3000} rows={5} defaultValue={initial.description ?? ""} className="input min-h-11" />
      </Field>
      {error && <Notice variant="danger">{error}</Notice>}
      {message && <Notice variant="success">{message}</Notice>}
      <button type="submit" disabled={saving} className={buttonClasses("primary", "lg", "w-full sm:w-auto")}>{saving ? "Saving…" : "Save and resubmit"}</button>
    </form>
  );
}
