"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient as createStorageClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
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

export function SellForm() {
  const router = useRouter();
  const [selectedMake, setSelectedMake] = useState<VehicleMake | "">("");
  const [selectedModel, setSelectedModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const models = selectedMake ? vehicleMakesAndModels[selectedMake] : [];

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
      if (files.length < 1 || files.length > MAX_PHOTOS) {
        throw new Error(`Add between 1 and ${MAX_PHOTOS} photos.`);
      }

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
      window.setTimeout(() => router.push("/account"), 900);
    } catch (err) {
      if (createdListingId) {
        await fetch(`/api/listings/${encodeURIComponent(createdListingId)}`, { method: "DELETE" }).catch(() => undefined);
      }
      setError(err instanceof Error ? err.message : "Could not upload the listing. Please try again.");
      setMessage(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Sell your car</h1>
      <p className="mb-6 text-sm text-prairie-600">Private sellers only. New listings are reviewed before they become public.</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="space-y-3 rounded-2xl border border-prairie-200 bg-white p-4">
          <div><h2 className="font-semibold">Required vehicle details</h2><p className="text-xs text-prairie-500">Fields marked * must be completed.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="make" required value={selectedMake} onChange={(e) => { setSelectedMake(e.target.value as VehicleMake | ""); setSelectedModel(""); }} className="input">
              <option value="">Make *</option>{vehicleMakes.map((make) => <option key={make} value={make}>{make}</option>)}
            </select>
            <select name="model" required disabled={!selectedMake} value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="input disabled:bg-prairie-100">
              <option value="">Model *</option>{models.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input name="year" type="number" min="1980" max={new Date().getFullYear() + 1} placeholder="Year *" required className="input" />
            <input name="price" type="number" min="500" max="2000000" placeholder="Price (CAD) *" required className="input" />
            <input name="mileage" type="number" min="0" max="2000000" placeholder="Mileage (km) *" required className="input" />
          </div>
          <select name="fuel" required className="input"><option value="">Fuel *</option>{fuelTypes.map((fuel) => <option key={fuel}>{fuel}</option>)}</select>
        </section>

        <details className="rounded-2xl border border-prairie-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">Optional vehicle details</summary>
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <select name="bodyType" className="input"><option value="">Body type</option>{bodyTypes.map((value) => <option key={value}>{value}</option>)}</select>
              <select name="city" className="input"><option value="">City</option>{albertaCities.map((city) => <option key={city}>{city}</option>)}</select>
              <select name="transmission" className="input"><option value="">Transmission</option>{transmissions.map((value) => <option key={value}>{value}</option>)}</select>
              <select name="drivetrain" className="input"><option value="">Drivetrain</option>{drivetrains.map((value) => <option key={value}>{value}</option>)}</select>
              <input name="color" placeholder="Colour" className="input" />
              <input name="engine" placeholder="Engine (e.g. 2.5 L)" className="input" />
            </div>
            <fieldset className="rounded-lg border border-prairie-200 p-3"><legend className="px-1 text-sm text-prairie-600">Features</legend>
              <div className="grid gap-2 text-sm sm:grid-cols-2">{vehicleFeatures.map((feature) => <label key={feature} className="flex items-center gap-2"><input type="checkbox" name="features" value={feature} /> {feature}</label>)}</div>
            </fieldset>
            <textarea name="description" maxLength={3000} rows={5} placeholder="Description, condition, service history, reason for selling…" className="input" />
          </div>
        </details>

        <section className="space-y-3 rounded-2xl border border-prairie-200 bg-white p-4">
          <div><h2 className="font-semibold">Seller contact</h2><p className="text-xs text-prairie-500">Add at least a phone number or email address.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="sellerPhone" type="tel" autoComplete="tel" placeholder="Phone" className="input" />
            <input name="sellerEmail" type="email" autoComplete="email" placeholder="Email" className="input" />
          </div>
        </section>

        <label className="block rounded-2xl border border-prairie-200 bg-white p-4">
          <span className="text-sm font-semibold">Photos *</span>
          <span className="mt-1 block text-xs text-prairie-500">1–8 photos. Large phone photos are automatically resized and compressed before direct upload.</span>
          <input name="images" type="file" accept="image/*" multiple required className="input mt-3" />
        </label>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        <button type="submit" disabled={submitting} className="w-full rounded-full bg-rig-700 py-2.5 text-prairie-50 hover:bg-rig-900 disabled:opacity-50">
          {submitting ? "Preparing photos…" : "Submit for review"}
        </button>
      </form>
    </div>
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
