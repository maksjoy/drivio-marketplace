"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

    try {
      const formData = new FormData(form);
      const res = await fetch("/api/listings", { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error ?? "Something went wrong.");
        return;
      }

      setMessage(body.message ?? "Listing submitted.");
      form.reset();
      setSelectedMake("");
      setSelectedModel("");
      window.setTimeout(() => router.push("/account"), 800);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Sell your car</h1>
      <p className="mb-6 text-sm text-prairie-600">
        Private sellers only. New listings are reviewed before they become public.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="space-y-3 rounded-2xl border border-prairie-200 bg-white p-4">
          <div>
            <h2 className="font-semibold">Required vehicle details</h2>
            <p className="text-xs text-prairie-500">Fields marked required must be completed.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              name="make"
              required
              value={selectedMake}
              onChange={(e) => {
                setSelectedMake(e.target.value as VehicleMake | "");
                setSelectedModel("");
              }}
              className="input"
            >
              <option value="">Make *</option>
              {vehicleMakes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </select>
            <select
              name="model"
              required
              disabled={!selectedMake}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="input disabled:bg-prairie-100"
            >
              <option value="">Model *</option>
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <input name="year" type="number" min="1980" max={new Date().getFullYear() + 1} placeholder="Year *" required className="input" />
            <input name="price" type="number" min="500" max="2000000" placeholder="Price (CAD) *" required className="input" />
            <input name="mileage" type="number" min="0" max="2000000" placeholder="Mileage (km) *" required className="input" />
          </div>

          <select name="fuel" required className="input">
            <option value="">Fuel *</option>
            {fuelTypes.map((fuel) => (
              <option key={fuel} value={fuel}>
                {fuel}
              </option>
            ))}
          </select>
        </section>

        <details className="rounded-2xl border border-prairie-200 bg-white p-4">
          <summary className="cursor-pointer font-semibold">Optional vehicle details</summary>
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <select name="bodyType" className="input">
                <option value="">Body type</option>
                {bodyTypes.map((body) => <option key={body}>{body}</option>)}
              </select>
              <select name="city" className="input">
                <option value="">City</option>
                {albertaCities.map((city) => <option key={city}>{city}</option>)}
              </select>
              <select name="transmission" className="input">
                <option value="">Transmission</option>
                {transmissions.map((transmission) => <option key={transmission}>{transmission}</option>)}
              </select>
              <select name="drivetrain" className="input">
                <option value="">Drivetrain</option>
                {drivetrains.map((drivetrain) => <option key={drivetrain}>{drivetrain}</option>)}
              </select>
              <input name="color" placeholder="Colour" className="input" />
              <input name="engine" placeholder="Engine (e.g. 2.5L I4)" className="input" />
            </div>

            <fieldset className="rounded-lg border border-prairie-200 p-3">
              <legend className="px-1 text-sm text-prairie-600">Features</legend>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                {vehicleFeatures.map((feature) => (
                  <label key={feature} className="flex items-center gap-2">
                    <input type="checkbox" name="features" value={feature} /> {feature}
                  </label>
                ))}
              </div>
            </fieldset>

            <textarea
              name="description"
              maxLength={3000}
              rows={5}
              placeholder="Description, condition, service history, reason for selling…"
              className="input"
            />
          </div>
        </details>

        <section className="space-y-3 rounded-2xl border border-prairie-200 bg-white p-4">
          <div>
            <h2 className="font-semibold">Seller contact</h2>
            <p className="text-xs text-prairie-500">Add at least one: phone, email or Telegram.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="sellerPhone" type="tel" placeholder="Phone" className="input" />
            <input name="sellerEmail" type="email" placeholder="Email" className="input" />
          </div>
          <input name="sellerTelegram" placeholder="Telegram username (e.g. @johncars)" className="input" />
        </section>

        <label className="block rounded-2xl border border-prairie-200 bg-white p-4">
          <span className="text-sm font-semibold">Photos *</span>
          <span className="mt-1 block text-xs text-prairie-500">1–8 JPG/PNG/WebP photos, max 8 MB each.</span>
          <input
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            required
            className="input mt-3"
          />
        </label>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-rig-700 py-2.5 text-prairie-50 hover:bg-rig-900 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
      </form>
    </div>
  );
}
