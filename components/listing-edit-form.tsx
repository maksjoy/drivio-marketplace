"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  type FeatureSlug,
  type VehicleMake,
} from "@/lib/listings";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { buttonClasses } from "@/components/ui/button";
import { useListingValidation } from "@/components/use-listing-validation";
import {
  isListingField,
  LISTING_LIMITS,
  listingYearMax,
  validateListingFields,
  type ListingField,
} from "@/lib/listing-rules";

const EDIT_FIELD_IDS: Record<ListingField, string> = {
  make: "edit-make",
  model: "edit-model",
  year: "edit-year",
  price: "edit-price",
  mileage: "edit-mileage",
  fuel: "edit-fuel",
  bodyType: "edit-body-type",
  city: "edit-city",
  transmission: "edit-transmission",
  drivetrain: "edit-drivetrain",
  color: "edit-color",
  engineL: "edit-engine",
  powerHp: "edit-power",
  description: "edit-description",
  sellerPhone: "edit-phone",
  photos: "edit-photos",
};

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
  const validation = useListingValidation(EDIT_FIELD_IDS);
  const { errors, onBlur, onChange } = validation;
  const fieldContext = { make, fuel };
  const engineValue = initial.engineL === null || initial.engineL === undefined || initial.engineL === ""
    ? ""
    : Number(initial.engineL).toFixed(1);

  function toggleFeature(slug: string, checked: boolean) {
    setFeatures((current) => checked ? [...current, slug] : current.filter((value) => value !== slug));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    const invalid = validateListingFields({
      make,
      model,
      year: text("year"),
      price: text("price"),
      mileage: text("mileage"),
      fuel,
      bodyType: text("bodyType"),
      city: text("city"),
      transmission: text("transmission"),
      drivetrain: text("drivetrain"),
      color: text("color"),
      ...(electric ? {} : { engineL: text("engineL") }),
      powerHp: text("powerHp"),
      description: text("description"),
    });
    if (!validation.reportAll(invalid)) return;
    setSaving(true);
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
      if (!response.ok) {
        if (response.status === 400 && isListingField(body.field) && typeof body.error === "string") validation.reportServer(body.field, body.error);
        throw new Error(body.error ?? "Could not update the listing.");
      }
      setMessage("Submitted for review.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the listing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form method="post" action={`/listings/${encodeURIComponent(listingId)}`} onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
      <p className="text-sm text-muted">Saving changes sends this listing back to review.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Make" htmlFor="edit-make" error={errors.make}>
          <select id="edit-make" value={make} onChange={(event) => { setMake(event.target.value); setModel(""); onChange("make", event.target.value); onChange("model", "", { make: event.target.value }); }} onBlur={(event) => onBlur("make", event.currentTarget.value)} {...validation.a11y("make")} className="input min-h-11">
            {vehicleMakes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Model" htmlFor="edit-model" error={errors.model}>
          <select id="edit-model" value={model} onChange={(event) => { setModel(event.target.value); onChange("model", event.target.value, fieldContext); }} onBlur={(event) => onBlur("model", event.currentTarget.value, fieldContext)} {...validation.a11y("model")} className="input min-h-11">
            {!model && <option value="">Select</option>}
            {models.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Year" htmlFor="edit-year" error={errors.year}><input id="edit-year" name="year" type="number" inputMode="numeric" min={LISTING_LIMITS.yearMin} max={listingYearMax()} defaultValue={initial.year} required onBlur={(event) => onBlur("year", event.currentTarget.value)} onChange={(event) => onChange("year", event.currentTarget.value)} {...validation.a11y("year")} className="input min-h-11" /></Field>
        <Field label="Price (CAD)" htmlFor="edit-price" error={errors.price}><input id="edit-price" name="price" type="number" inputMode="numeric" min={LISTING_LIMITS.priceMin} max={LISTING_LIMITS.priceMax} defaultValue={initial.price} required onBlur={(event) => onBlur("price", event.currentTarget.value)} onChange={(event) => onChange("price", event.currentTarget.value)} {...validation.a11y("price")} className="input min-h-11" /></Field>
        <Field label="Mileage (km)" htmlFor="edit-mileage" error={errors.mileage}><input id="edit-mileage" name="mileage" type="number" inputMode="numeric" min={LISTING_LIMITS.mileageMin} max={LISTING_LIMITS.mileageMax} defaultValue={initial.mileage} required onBlur={(event) => onBlur("mileage", event.currentTarget.value)} onChange={(event) => onChange("mileage", event.currentTarget.value)} {...validation.a11y("mileage")} className="input min-h-11" /></Field>
        <Field label="Fuel" htmlFor="edit-fuel" error={errors.fuel}>
          <select id="edit-fuel" value={fuel} onChange={(event) => { setFuel(event.target.value); onChange("fuel", event.target.value); if (event.target.value === "Electric") validation.setFieldError("engineL", null); }} onBlur={(event) => onBlur("fuel", event.currentTarget.value)} {...validation.a11y("fuel")} className="input min-h-11">
            {fuelTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Body type" htmlFor="edit-body-type" error={errors.bodyType}>
          <select id="edit-body-type" name="bodyType" {...validation.a11y("bodyType")} defaultValue={initial.bodyType ?? ""} className="input min-h-11">
            <option value="">Body type</option>
            {bodyTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="City" htmlFor="edit-city" error={errors.city}>
          <select id="edit-city" name="city" {...validation.a11y("city")} defaultValue={initial.city ?? ""} className="input min-h-11">
            <option value="">City</option>
            {albertaCities.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Transmission" htmlFor="edit-transmission" error={errors.transmission}>
          <select id="edit-transmission" name="transmission" {...validation.a11y("transmission")} defaultValue={initial.transmission ?? ""} className="input min-h-11">
            <option value="">Transmission</option>
            {transmissions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Drivetrain" htmlFor="edit-drivetrain" error={errors.drivetrain}>
          <select id="edit-drivetrain" name="drivetrain" {...validation.a11y("drivetrain")} defaultValue={initial.drivetrain ?? ""} className="input min-h-11">
            <option value="">Drivetrain</option>
            {drivetrains.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Colour" htmlFor="edit-color" error={errors.color}>
          <select id="edit-color" name="color" {...validation.a11y("color")} defaultValue={initial.color ?? ""} className="input min-h-11">
            <option value="">Colour</option>
            {COLORS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        {!electric && (
          <Field label="Engine (L)" htmlFor="edit-engine" error={errors.engineL}>
            <div className="relative">
              <input id="edit-engine" name="engineL" type="text" inputMode="decimal" placeholder="2.5" defaultValue={engineValue} onBlur={(event) => onBlur("engineL", event.currentTarget.value, fieldContext)} onChange={(event) => onChange("engineL", event.currentTarget.value, fieldContext)} {...validation.a11y("engineL")} className="input min-h-11 pr-10" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">L</span>
            </div>
          </Field>
        )}
        <Field label="Power (hp)" htmlFor="edit-power" error={errors.powerHp}>
          <div className="relative">
            <input id="edit-power" name="powerHp" type="number" inputMode="numeric" min={LISTING_LIMITS.powerMin} max={LISTING_LIMITS.powerMax} step={1} placeholder="180" defaultValue={initial.powerHp ?? ""} onBlur={(event) => onBlur("powerHp", event.currentTarget.value)} onChange={(event) => onChange("powerHp", event.currentTarget.value)} {...validation.a11y("powerHp")} className="input min-h-11 pr-12" />
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
                <input id={`edit-feature-${slug}`} type="checkbox" className="h-5 w-5 shrink-0 accent-primary" checked={features.includes(slug)} onChange={(event) => toggleFeature(slug, event.target.checked)} />
                {featureLabels[slug as FeatureSlug]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <Field label="Description" htmlFor="edit-description" error={errors.description}>
        <textarea id="edit-description" name="description" maxLength={LISTING_LIMITS.descriptionMax} onBlur={(event) => onBlur("description", event.currentTarget.value)} onChange={(event) => onChange("description", event.currentTarget.value)} {...validation.a11y("description")} rows={5} defaultValue={initial.description ?? ""} className="input min-h-11" />
      </Field>
      {validation.errorCount > 0 && !error && (
        <Notice variant="danger">
          {validation.errorCount === 1 ? "Fix the highlighted field before saving." : `Fix the ${validation.errorCount} highlighted fields before saving.`}
        </Notice>
      )}
      {error && <Notice variant="danger">{error}</Notice>}
      {message && <Notice variant="success">{message}</Notice>}
      <button type="submit" disabled={saving} className={buttonClasses("primary", "lg", "w-full sm:w-auto")}>{saving ? "Saving…" : "Save and resubmit"}</button>
    </form>
  );
}
