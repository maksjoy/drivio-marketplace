"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient as createStorageClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import {
  albertaCities,
  bodyTypes,
  drivetrains,
  fuelTypes,
  transmissions,
  vehicleFeatures,
  vehicleMakes,
  vehicleMakesAndModels,
  type VehicleMake,
} from "@/lib/listings";

const MAX_PHOTOS = 8;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const storageClient = createStorageClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

type UploadPlan = {
  position: number;
  storagePath: string;
  storageToken: string;
  thumbPath: string;
  thumbToken: string;
};

type DraftPhoto = {
  id: string;
  file: File;
  url: string;
};

export function SellForm() {
  const router = useRouter();
  const [selectedMake, setSelectedMake] = useState<VehicleMake | "">("");
  const [selectedModel, setSelectedModel] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const imagesRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<DraftPhoto[]>([]);
  const focusIdRef = useRef<string | null>(null);
  const models = selectedMake ? vehicleMakesAndModels[selectedMake] : [];

  useEffect(() => {
    const id = focusIdRef.current;
    if (!id) return;
    focusIdRef.current = null;
    document.getElementById(id)?.focus();
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.url);
    };
  }, []);

  function syncInput(items: DraftPhoto[]) {
    const input = imagesRef.current;
    if (!input) return;
    // Submit still reads this input's FileList, so preview order has to be written back here.
    const transfer = new DataTransfer();
    for (const item of items) transfer.items.add(item.file);
    input.files = transfer.files;
  }

  function commit(next: DraftPhoto[], options?: { sync?: boolean; focusId?: string }) {
    const previous = photosRef.current;
    photosRef.current = next;
    if (options?.focusId) focusIdRef.current = options.focusId;
    setPhotos(next);
    for (const photo of previous) {
      if (!next.some((item) => item.url === photo.url)) URL.revokeObjectURL(photo.url);
    }
    if (options?.sync) syncInput(next);
  }

  function onImagesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const current = photosRef.current;
    if (selected.length === current.length && selected.every((file, index) => file === current[index]?.file)) return;
    commit(selected.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    })));
    setAnnouncement(selected.length ? `${selected.length} of ${MAX_PHOTOS} photos selected.` : "No photos selected.");
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const current = photosRef.current;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= current.length) return;
    const next = current.slice();
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    const position = nextIndex + 1;
    const side = direction < 0 ? "left" : "right";
    commit(next, { sync: true, focusId: `sell-photo-${position}-${side}` });
    setAnnouncement(`Photo ${position} moved ${side}.`);
  }

  function makeCover(index: number) {
    if (index === 0) return;
    const next = photosRef.current.slice();
    const [item] = next.splice(index, 1);
    next.unshift(item);
    commit(next, { sync: true, focusId: "sell-photo-1-right" });
    setAnnouncement(`Photo 1 is now the cover.`);
  }

  function removePhoto(index: number) {
    const current = photosRef.current;
    const position = index + 1;
    const next = current.filter((_, itemIndex) => itemIndex !== index);
    const focusPosition = Math.min(index, Math.max(next.length - 1, 0)) + 1;
    commit(next, {
      sync: true,
      focusId: next.length ? `sell-photo-${focusPosition}-remove` : "sell-images",
    });
    setAnnouncement(`Photo ${position} removed. ${next.length} of ${MAX_PHOTOS} photos.`);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    const form = e.currentTarget;
    let createdListingId: string | null = null;

    try {
      const fileInput = form.elements.namedItem("images") as HTMLInputElement | null;
      const files = Array.from(fileInput?.files ?? []);
      if (files.length < 1 || files.length > MAX_PHOTOS) throw new Error(`Add between 1 and ${MAX_PHOTOS} photos.`);

      const formData = new FormData(form);
      formData.delete("images");
      formData.set("photoCount", String(files.length));

      const res = await fetch("/api/listings", { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");

      createdListingId = String(body.listingId || "");
      const plans = Array.isArray(body.uploads) ? body.uploads as UploadPlan[] : [];
      if (!createdListingId || plans.length !== files.length) throw new Error("Photo upload setup was incomplete.");

      setMessage("Optimizing and uploading photos…");
      for (let index = 0; index < files.length; index++) {
        const plan = plans[index];
        let main = await resizeToJpeg(files[index], 1800, 0.82);
        if (main.size > MAX_UPLOAD_BYTES) main = await resizeToJpeg(files[index], 1400, 0.72);
        if (main.size > MAX_UPLOAD_BYTES) main = await resizeToJpeg(files[index], 1200, 0.64);
        if (main.size > MAX_UPLOAD_BYTES) throw new Error(`Photo ${index + 1} is still too large after optimization.`);
        const thumb = await resizeToJpeg(files[index], 520, 0.76);

        const mainUpload = await storageClient.storage.from("listing-photos").uploadToSignedUrl(
          plan.storagePath,
          plan.storageToken,
          main,
          { contentType: "image/jpeg", upsert: false },
        );
        if (mainUpload.error) throw mainUpload.error;

        const thumbUpload = await storageClient.storage.from("listing-photos").uploadToSignedUrl(
          plan.thumbPath,
          plan.thumbToken,
          thumb,
          { contentType: "image/jpeg", upsert: false },
        );
        if (thumbUpload.error) throw thumbUpload.error;
      }

      setMessage("Submitted for review. Your listing will appear after approval.");
      form.reset();
      setSelectedMake("");
      setSelectedModel("");
      commit([]);
      setAnnouncement("");
      window.setTimeout(() => router.push("/account"), 900);
    } catch (err) {
      if (createdListingId) await fetch(`/api/listings/${encodeURIComponent(createdListingId)}`, { method: "DELETE" }).catch(() => undefined);
      setError(err instanceof Error ? err.message : "Could not upload the listing. Please try again.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Sell your car</h1>
      <p className="mb-6 text-sm text-muted">Private sellers only. New listings are reviewed before they become public.</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="space-y-3 p-4">
          <div>
            <h2 className="font-semibold">Required vehicle details</h2>
            <p className="text-xs text-muted">Fields marked * must be completed.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Make *" htmlFor="sell-make">
              <select
                id="sell-make"
                name="make"
                required
                value={selectedMake}
                onChange={(e) => { setSelectedMake(e.target.value as VehicleMake | ""); setSelectedModel(""); }}
                className="input min-h-11"
              >
                <option value="">Select</option>
                {vehicleMakes.map((make) => <option key={make} value={make}>{make}</option>)}
              </select>
            </Field>
            <Field label="Model *" htmlFor="sell-model">
              <select
                id="sell-model"
                name="model"
                required
                disabled={!selectedMake}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="input min-h-11 disabled:bg-surface-sunken"
              >
                <option value="">Select</option>
                {models.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Year *" htmlFor="sell-year">
              <input id="sell-year" name="year" type="number" min="1980" max={new Date().getFullYear() + 1} required className="input min-h-11" />
            </Field>
            <Field label="Price (CAD) *" htmlFor="sell-price">
              <input id="sell-price" name="price" type="number" min="500" max="2000000" required className="input min-h-11" />
            </Field>
            <Field label="Mileage (km) *" htmlFor="sell-mileage">
              <input id="sell-mileage" name="mileage" type="number" min="0" max="2000000" required className="input min-h-11" />
            </Field>
          </div>
          <Field label="Fuel *" htmlFor="sell-fuel">
            <select id="sell-fuel" name="fuel" required defaultValue="" className="input min-h-11">
              <option value="">Select</option>
              {fuelTypes.map((fuel) => <option key={fuel} value={fuel}>{fuel}</option>)}
            </select>
          </Field>
        </Card>

        <Card className="p-4">
          <details open>
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Optional vehicle details</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SelectField id="sell-body-type" name="bodyType" label="Body type" options={bodyTypes} />
              <SelectField id="sell-city" name="city" label="City" options={albertaCities} />
              <SelectField id="sell-transmission" name="transmission" label="Transmission" options={transmissions} />
              <SelectField id="sell-drivetrain" name="drivetrain" label="Drivetrain" options={drivetrains} />
              <Field label="Colour" htmlFor="sell-color">
                <input id="sell-color" name="color" className="input min-h-11" />
              </Field>
              <Field label="Engine (L)" htmlFor="sell-engine">
                <div className="relative">
                  <input id="sell-engine" name="engine" placeholder="2.5" className="input min-h-11 pr-10" />
                  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-normal text-muted">L</span>
                </div>
              </Field>
              <fieldset className="rounded-control border border-line p-3 sm:col-span-2">
                <legend className="px-1 text-sm font-medium text-ink">Features</legend>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {vehicleFeatures.map((feature, index) => {
                    const id = `sell-feature-${index}`;
                    return (
                      <li key={feature}>
                        <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm font-normal">
                          <input id={id} type="checkbox" name="features" value={feature} className="h-6 w-6 shrink-0 accent-primary" />
                          {feature}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
              <Field label="Description" htmlFor="sell-description" hint="Condition, service history, reason for selling." className="sm:col-span-2">
                <textarea id="sell-description" name="description" maxLength={3000} rows={5} aria-describedby="sell-description-hint" className="input min-h-11" />
              </Field>
            </div>
          </details>
        </Card>

        <section className="space-y-3 rounded-card border border-success/30 bg-success-soft/40 p-4">
          <div>
            <h2 className="font-semibold">Private phone number <span className="font-normal text-muted">(optional)</span></h2>
            <p className="mt-1 text-xs leading-5 text-muted">Your account email is already your private contact. Neither email nor phone is shown on the listing. Buyers contact you through Alberta Cars Messages first, and you decide if you want to share your phone later.</p>
          </div>
          <Field label="Phone (optional)" htmlFor="sell-phone">
            <input id="sell-phone" name="sellerPhone" type="tel" autoComplete="tel" className="input min-h-11 bg-white" />
          </Field>
        </section>

        <Card className="space-y-3 p-4">
          <Field label="Photos *" htmlFor="sell-images">
            <p id="sell-images-hint" className="mb-1.5 text-xs font-normal text-muted">1–8 photos. Large phone photos are automatically resized and compressed before direct upload.</p>
            <input
              ref={imagesRef}
              id="sell-images"
              name="images"
              type="file"
              accept="image/*"
              multiple
              required
              aria-describedby="sell-images-hint"
              onChange={onImagesChange}
              className="input min-h-11"
            />
          </Field>
          {photos.length > 0 && (
            <>
              <p className="text-sm font-semibold text-ink">{photos.length} of {MAX_PHOTOS} photos</p>
              <ul aria-label="Selected photos" className="space-y-3">
                {photos.map((photo, index) => {
                  const position = index + 1;
                  return (
                    <li key={photo.id} className="flex gap-3 rounded-control border border-line bg-surface p-2">
                      <div className="h-20 w-24 flex-none overflow-hidden rounded-control bg-surface-sunken">
                        <img src={photo.url} alt="" width={96} height={80} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">Photo {position}</p>
                          {index === 0 ? <Chip tone="primary">Cover</Chip> : null}
                        </div>
                        {index > 0 && (
                          <Button type="button" variant="secondary" size="sm" onClick={() => makeCover(index)}>
                            Make cover
                          </Button>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            id={`sell-photo-${position}-left`}
                            variant="secondary"
                            size="sm"
                            className="min-h-11 min-w-11 px-0"
                            aria-label={`Move photo ${position} left`}
                            disabled={index === 0}
                            onClick={() => movePhoto(index, -1)}
                          >
                            <ArrowIcon direction="left" />
                            <span className="sr-only">Move photo {position} left</span>
                          </Button>
                          <Button
                            type="button"
                            id={`sell-photo-${position}-right`}
                            variant="secondary"
                            size="sm"
                            className="min-h-11 min-w-11 px-0"
                            aria-label={`Move photo ${position} right`}
                            disabled={index === photos.length - 1}
                            onClick={() => movePhoto(index, 1)}
                          >
                            <ArrowIcon direction="right" />
                            <span className="sr-only">Move photo {position} right</span>
                          </Button>
                          <Button
                            type="button"
                            id={`sell-photo-${position}-remove`}
                            variant="secondary"
                            size="sm"
                            className="min-h-11 min-w-11 px-0 text-danger"
                            aria-label={`Remove photo ${position}`}
                            onClick={() => removePhoto(index)}
                          >
                            <RemoveIcon />
                            <span className="sr-only">Remove photo {position}</span>
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <p className="sr-only" role="status">{announcement}</p>
        </Card>

        {error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>}
        {message && <p className="rounded-lg bg-success-soft p-3 text-sm text-success">{message}</p>}
        <Button type="submit" variant="accent" size="lg" disabled={submitting} className="w-full">
          {submitting ? "Preparing photos…" : "Submit for review"}
        </Button>
      </form>
    </div>
  );
}

function SelectField({
  id,
  name,
  label,
  options,
}: {
  id: string;
  name: string;
  label: string;
  options: readonly string[];
}) {
  return (
    <Field label={label} htmlFor={id}>
      <select id={id} name={name} defaultValue="" className="input min-h-11">
        <option value="">Select</option>
        {options.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </Field>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      {direction === "left" ? <path d="M15 6 9 12l6 6" /> : <path d="m9 6 6 6-6 6" />}
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

async function resizeToJpeg(file: File, maxDimension: number, quality: number): Promise<Blob> {
  const image = await loadImage(file);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error(`Could not read ${file.name}.`);

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser cannot optimize photos.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(`Could not optimize ${file.name}.`)), "image/jpeg", quality);
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unsupported photo format: ${file.name}.`));
      image.src = url;
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
