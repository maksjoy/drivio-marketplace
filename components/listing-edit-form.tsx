"use client";

import { useEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEditLeave } from "@/components/edit-leave-guard";
import {
  albertaCities,
  bodyTypes,
  COLORS,
  COLOR_SWATCH,
  drivetrains,
  featureGroups,
  featureLabels,
  fuelTypes,
  transmissions,
  vehicleMakes,
  vehicleMakesAndModels,
  type ExteriorColor,
  type FeatureSlug,
  type VehicleMake,
} from "@/lib/listings";
import { Field, fieldErrorId } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

/** On-screen order. Engine sits with Fuel, ahead of the optional details. */
const EDIT_FIELD_ORDER = [
  "make", "model", "year", "price", "mileage", "fuel", "engineL",
  "transmission", "drivetrain", "bodyType", "city", "powerHp", "color",
  "description",
] as const satisfies readonly ListingField[];

const LIGHT_SWATCH = new Set<ExteriorColor>(["White", "Silver", "Beige", "Yellow"]);
const DARK_CHECK = new Set<ExteriorColor>(["Black", "Grey", "Blue", "Red", "Green", "Brown", "Orange", "Purple"]);

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

function listingSnapshot(form: HTMLFormElement) {
  const data = new FormData(form);
  const text = (name: string) => {
    const value = data.get(name);
    return typeof value === "string" ? value : "";
  };
  const selectedFeatures = data.getAll("features").filter((value): value is string => typeof value === "string").sort();
  return JSON.stringify({
    make: text("make"),
    model: text("model"),
    year: text("year"),
    price: text("price"),
    mileage: text("mileage"),
    fuel: text("fuel"),
    bodyType: text("bodyType"),
    city: text("city"),
    transmission: text("transmission"),
    drivetrain: text("drivetrain"),
    color: text("color"),
    engineL: text("engineL"),
    powerHp: text("powerHp"),
    description: text("description"),
    features: selectedFeatures,
  });
}

export function ListingEditForm({ listingId, initial }: { listingId: string; initial: ListingEditValues }) {
  const router = useRouter();
  const leave = useEditLeave();
  const formRef = useRef<HTMLFormElement>(null);
  const initialKey = useRef<string | null>(null);
  const savedRef = useRef(false);
  const [make, setMake] = useState(initial.make);
  const [model, setModel] = useState(initial.model);
  const [fuel, setFuel] = useState(initial.fuel);
  const [color, setColor] = useState(initial.color ?? "");
  const [features, setFeatures] = useState<string[]>(initial.features);
  const [descriptionLength, setDescriptionLength] = useState((initial.description ?? "").length);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const models = make in vehicleMakesAndModels ? vehicleMakesAndModels[make as VehicleMake] : [];
  const electric = fuel === "Electric";
  const validation = useListingValidation(EDIT_FIELD_IDS, EDIT_FIELD_ORDER);
  const { errors, onBlur, onChange } = validation;
  const fieldContext = { make, fuel };
  const engineValue = initial.engineL === null || initial.engineL === undefined || initial.engineL === ""
    ? ""
    : Number(initial.engineL).toFixed(1);
  const editPath = `/listings/${encodeURIComponent(listingId)}/edit`;
  const descriptionMax = LISTING_LIMITS.descriptionMax;
  const descriptionRemaining = descriptionMax - descriptionLength;

  function syncDirty() {
    const form = formRef.current;
    if (!form || initialKey.current == null || savedRef.current) return;
    leave.setDirty(listingSnapshot(form) !== initialKey.current);
  }

  useEffect(() => {
    const form = formRef.current;
    if (!form || savedRef.current) return;
    const key = listingSnapshot(form);
    if (initialKey.current == null) {
      initialKey.current = key;
      return;
    }
    leave.setDirty(key !== initialKey.current);
  }, [make, model, fuel, color, features, descriptionLength, leave.setDirty]);

  function toggleFeature(slug: string, checked: boolean) {
    setFeatures((current) => checked ? [...current, slug] : current.filter((value) => value !== slug));
  }

  function chooseColor(value: string) {
    const next = color === value ? "" : value;
    setColor(next);
    onChange("color", next);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
    let saved = false;
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
      saved = true;
      savedRef.current = true;
      leave.setDirty(false);
      router.push(`/listings/${encodeURIComponent(listingId)}?saved=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the listing.");
    } finally {
      if (!saved) setSaving(false);
    }
  }

  return (
    <form ref={formRef} method="post" action={editPath} onSubmit={onSubmit} onInput={syncDirty} onChange={syncDirty} noValidate className="mt-5 [&_input]:scroll-mb-28 [&_select]:scroll-mb-28 [&_textarea]:scroll-mb-28">
      <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <section aria-labelledby="basics-h">
            <div className="mb-4">
              <h2 id="basics-h" className="text-base font-semibold text-ink">Basics</h2>
              <p className="mt-0.5 text-xs text-muted">Required. Shown on your listing card.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Make" htmlFor="edit-make" error={errors.make}>
                <SelectControl id="edit-make" name="make" value={make} onChange={(event) => { setMake(event.target.value); setModel(""); onChange("make", event.target.value); onChange("model", "", { make: event.target.value }); }} onBlur={(event) => onBlur("make", event.currentTarget.value)} {...validation.a11y("make")}>
                  {vehicleMakes.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectControl>
              </Field>
              <Field label="Model" htmlFor="edit-model" error={errors.model}>
                <SelectControl id="edit-model" name="model" value={model} onChange={(event) => { setModel(event.target.value); onChange("model", event.target.value, fieldContext); }} onBlur={(event) => onBlur("model", event.currentTarget.value, fieldContext)} {...validation.a11y("model")}>
                  {!model && <option value="">Select</option>}
                  {models.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectControl>
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Year" htmlFor="edit-year" error={errors.year}>
                <input id="edit-year" name="year" type="number" inputMode="numeric" min={LISTING_LIMITS.yearMin} max={listingYearMax()} defaultValue={initial.year} required onBlur={(event) => onBlur("year", event.currentTarget.value)} onChange={(event) => onChange("year", event.currentTarget.value)} {...validation.a11y("year")} className="input min-h-11" />
              </Field>
              <Field label="Price (CAD)" htmlFor="edit-price" error={errors.price}>
                <input id="edit-price" name="price" type="number" inputMode="numeric" min={LISTING_LIMITS.priceMin} max={LISTING_LIMITS.priceMax} defaultValue={initial.price} required onBlur={(event) => onBlur("price", event.currentTarget.value)} onChange={(event) => onChange("price", event.currentTarget.value)} {...validation.a11y("price")} className="input min-h-11" />
              </Field>
              <Field label="Mileage (km)" htmlFor="edit-mileage" error={errors.mileage} className="col-span-2 sm:col-span-1">
                <input id="edit-mileage" name="mileage" type="number" inputMode="numeric" min={LISTING_LIMITS.mileageMin} max={LISTING_LIMITS.mileageMax} defaultValue={initial.mileage} required onBlur={(event) => onBlur("mileage", event.currentTarget.value)} onChange={(event) => onChange("mileage", event.currentTarget.value)} {...validation.a11y("mileage")} className="input min-h-11" />
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Fuel" htmlFor="edit-fuel" error={errors.fuel}>
                <SelectControl id="edit-fuel" name="fuel" value={fuel} onChange={(event) => { setFuel(event.target.value); onChange("fuel", event.target.value); if (event.target.value === "Electric") validation.setFieldError("engineL", null); }} onBlur={(event) => onBlur("fuel", event.currentTarget.value)} {...validation.a11y("fuel")}>
                  {fuelTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectControl>
              </Field>
              {!electric && (
                <Field label="Engine (L)" htmlFor="edit-engine" error={errors.engineL}>
                  <div className="relative">
                    <input id="edit-engine" name="engineL" type="text" inputMode="decimal" placeholder="2.5" defaultValue={engineValue} onBlur={(event) => onBlur("engineL", event.currentTarget.value, fieldContext)} onChange={(event) => onChange("engineL", event.currentTarget.value, fieldContext)} {...validation.a11y("engineL")} className="input min-h-11 pr-10" />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">L</span>
                  </div>
                </Field>
              )}
            </div>
          </section>
        </Card>

        <Card className="p-4 sm:p-5">
          <section aria-labelledby="optional-h">
            <div className="mb-4">
              <h2 id="optional-h" className="text-base font-semibold text-ink">Optional vehicle details</h2>
              <p className="mt-0.5 text-xs text-muted">Buyers filter by these. Fill in what you know.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Transmission" htmlFor="edit-transmission" error={errors.transmission}>
                <SelectControl id="edit-transmission" name="transmission" defaultValue={initial.transmission ?? ""} {...validation.a11y("transmission")}>
                  <option value="">Transmission</option>
                  {transmissions.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectControl>
              </Field>
              <Field label="Drivetrain" htmlFor="edit-drivetrain" error={errors.drivetrain}>
                <SelectControl id="edit-drivetrain" name="drivetrain" defaultValue={initial.drivetrain ?? ""} {...validation.a11y("drivetrain")}>
                  <option value="">Drivetrain</option>
                  {drivetrains.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectControl>
              </Field>
              <Field label="Body type" htmlFor="edit-body-type" error={errors.bodyType}>
                <SelectControl id="edit-body-type" name="bodyType" defaultValue={initial.bodyType ?? ""} {...validation.a11y("bodyType")}>
                  <option value="">Body type</option>
                  {bodyTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectControl>
              </Field>
              <Field label="City" htmlFor="edit-city" error={errors.city}>
                <SelectControl id="edit-city" name="city" defaultValue={initial.city ?? ""} {...validation.a11y("city")}>
                  <option value="">City</option>
                  {albertaCities.map((item) => <option key={item} value={item}>{item}</option>)}
                </SelectControl>
              </Field>
              <Field label="Power (hp)" htmlFor="edit-power" error={errors.powerHp} className="col-span-2 sm:col-span-1">
                <div className="relative">
                  <input id="edit-power" name="powerHp" type="number" inputMode="numeric" min={LISTING_LIMITS.powerMin} max={LISTING_LIMITS.powerMax} step={1} placeholder="180" defaultValue={initial.powerHp ?? ""} onBlur={(event) => onBlur("powerHp", event.currentTarget.value)} onChange={(event) => onChange("powerHp", event.currentTarget.value)} {...validation.a11y("powerHp")} className="input min-h-11 pr-12" />
                  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-normal text-muted">hp</span>
                </div>
              </Field>
            </div>

            <fieldset id="edit-color" tabIndex={-1} {...validation.a11y("color")} className="mt-5 scroll-mb-28 rounded-control focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary">
              <legend className="mb-2 text-sm font-medium text-ink">
                Colour{color ? <span className="font-normal text-muted"> · {color}</span> : null}
              </legend>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                {COLORS.map((item) => {
                  const selected = color === item;
                  return (
                    <label key={item} className={`relative flex min-h-11 cursor-pointer flex-col items-center gap-1 rounded-control px-1 py-1.5 text-xs font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${selected ? "bg-primary-soft text-primary-strong ring-2 ring-primary" : "text-ink-soft hover:bg-surface-sunken"}`}>
                      <input
                        id={`edit-color-${item}`}
                        type="radio"
                        name="color"
                        value={item}
                        checked={selected}
                        onChange={() => chooseColor(item)}
                        onClick={(event) => { if (!selected) return; event.preventDefault(); chooseColor(item); }}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                      <span className={`relative h-7 w-7 rounded-full ${swatchClass(item)}`}>
                        {selected && (
                          <span className={`absolute inset-0 flex items-center justify-center ${DARK_CHECK.has(item) ? "text-white" : "text-ink"}`}>
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>
                          </span>
                        )}
                      </span>
                      {item}
                    </label>
                  );
                })}
              </div>
              {errors.color && <FieldError id={fieldErrorId("edit-color")} message={errors.color} />}
            </fieldset>

            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-ink">Options</p>
              <div className="space-y-2">
                {featureGroups.map((group, index) => {
                  const selected = group.slugs.filter((slug) => features.includes(slug)).length;
                  const defaultOpen = index === 0 || selected > 0;
                  return (
                    <OptionGroup key={group.id} label={group.label} selected={selected} defaultOpen={defaultOpen}>
                      <ul className="grid gap-1 px-3 pb-2 sm:grid-cols-2">
                        {group.slugs.map((slug) => {
                          const id = `edit-feature-${slug}`;
                          return (
                            <li key={slug}>
                              <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm font-normal text-ink">
                                <input id={id} name="features" value={slug} type="checkbox" className="h-6 w-6 shrink-0 accent-primary" checked={features.includes(slug)} onChange={(event) => toggleFeature(slug, event.target.checked)} />
                                {featureLabels[slug as FeatureSlug]}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </OptionGroup>
                  );
                })}
              </div>
            </div>
          </section>
        </Card>

        <Card className="p-4 sm:p-5">
          <label htmlFor="edit-description" className="block text-base font-semibold text-ink">Description</label>
          <p id="edit-description-hint" className="mb-3 mt-0.5 text-xs text-muted">Condition, service history, reason for selling.</p>
          <textarea
            id="edit-description"
            name="description"
            rows={6}
            maxLength={descriptionMax}
            defaultValue={initial.description ?? ""}
            onBlur={(event) => onBlur("description", event.currentTarget.value)}
            onChange={(event) => { setDescriptionLength(event.currentTarget.value.length); onChange("description", event.currentTarget.value); }}
            {...validation.a11y("description", "edit-description-hint", "edit-description-count")}
            className="input min-h-11"
          />
          {errors.description && <FieldError id={fieldErrorId("edit-description")} message={errors.description} />}
          <p id="edit-description-count" className={`mt-1 text-right text-xs tabular-nums ${descriptionRemaining < 100 ? "text-danger" : "text-muted"}`}>
            {descriptionLength.toLocaleString("en-CA")} / {descriptionMax.toLocaleString("en-CA")}
          </p>
        </Card>

        {validation.errorCount > 0 && !error && (
          <Notice variant="danger">
            {validation.errorCount === 1 ? "Fix the highlighted field before saving." : `Fix the ${validation.errorCount} highlighted fields before saving.`}
          </Notice>
        )}
        {error && <Notice variant="danger">{error}</Notice>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-sheet backdrop-blur md:sticky md:inset-x-auto md:bottom-4 md:mt-6 md:rounded-card md:border md:p-3 md:shadow-lift">
        <div className="mx-auto flex max-w-[720px] items-center gap-3 md:justify-end">
          <p className="mr-auto hidden text-sm text-muted md:block">Changes go to review after saving.</p>
          <Link
            href={`/listings/${listingId}`}
            className={buttonClasses("secondary", "lg", "shrink-0 !px-4")}
            onClick={(event) => {
              if (!leave.dirty) return;
              event.preventDefault();
              leave.ask(`/listings/${listingId}`, event.currentTarget);
            }}
          >
            Cancel
          </Link>
          <Button type="submit" variant="primary" size="lg" disabled={saving} className="min-h-12 flex-1 whitespace-nowrap md:flex-none">{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </form>
  );
}

function OptionGroup({ label, selected, defaultOpen, children }: { label: string; selected: number; defaultOpen: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen || undefined} className="group rounded-control border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-control px-3 text-sm font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span>{label} <span className="font-normal text-muted">· {selected} selected</span></span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-muted transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      {children}
    </details>
  );
}

function SelectControl({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={["input min-h-11 appearance-none pr-9", className].filter(Boolean).join(" ")}>{children}</select>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </span>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <span id={id} className="mt-1 flex items-start gap-1 text-xs font-medium text-danger">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-px h-3.5 w-3.5 flex-none" fill="currentColor"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-.9 4h1.8v5.2H9.1V6Zm0 6.8h1.8v1.8H9.1v-1.8Z" /></svg>
      <span>{message}</span>
    </span>
  );
}

function swatchClass(color: ExteriorColor) {
  const swatch = COLOR_SWATCH[color];
  if (color === "Other") return `${swatch} border-2 border-dashed border-line-strong`;
  if (LIGHT_SWATCH.has(color)) return `${swatch} border border-line-strong`;
  return swatch;
}
