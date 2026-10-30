// Listing field rules shared by the sell form, the edit form and the server Zod schema.
// Plain functions only: this file ships in the client bundle, and Zod's eval probe
// trips the CSP (script-src has no 'unsafe-eval'). Keep it free of zod imports.
import {
  albertaCities,
  bodyTypes,
  COLORS,
  drivetrains,
  fuelTypes,
  transmissions,
  vehicleMakes,
  vehicleMakesAndModels,
  type VehicleMake,
} from "./listings";

export const LISTING_LIMITS = {
  yearMin: 1980,
  priceMin: 500,
  priceMax: 2_000_000,
  mileageMin: 0,
  mileageMax: 2_000_000,
  engineMin: 0.6,
  engineMax: 8.5,
  powerMin: 40,
  powerMax: 1500,
  modelMax: 120,
  descriptionMax: 3000,
  phoneMax: 30,
  photosMin: 1,
  photosMax: 8,
} as const;

export const listingYearMax = () => new Date().getFullYear() + 1;

export const LISTING_MESSAGES = {
  make: "Choose a make.",
  model: "Choose a model.",
  modelForMake: "Choose a model for the selected make.",
  makeBeforeModel: "Choose a make before the model.",
  year: (max = listingYearMax()) => `Enter a year from ${LISTING_LIMITS.yearMin} to ${max}.`,
  price: "Enter a price from $500 to $2,000,000.",
  mileage: "Enter mileage from 0 to 2,000,000 km.",
  fuel: "Choose a fuel type.",
  bodyType: "Choose a body type from the list.",
  transmission: "Choose a transmission from the list.",
  drivetrain: "Choose a drivetrain from the list.",
  city: "Choose a city from the list.",
  color: "Choose a colour from the list.",
  engineL: "Enter engine volume from 0.6 to 8.5 L.",
  powerHp: "Enter power from 40 to 1500 hp.",
  description: "Keep the description to 3,000 characters or fewer.",
  sellerPhone: "Enter a phone number of up to 30 characters.",
  photos: "Add between 1 and 8 photos.",
} as const;

export type ListingField =
  | "make" | "model" | "year" | "price" | "mileage" | "fuel"
  | "bodyType" | "city" | "transmission" | "drivetrain" | "color"
  | "engineL" | "powerHp" | "description" | "sellerPhone" | "photos";

export type ListingFieldErrors = Partial<Record<ListingField, string>>;

/** Fields in on-screen order, so "first invalid field" means the first one a seller sees. */
export const LISTING_FIELD_ORDER: readonly ListingField[] = [
  "make", "model", "year", "price", "mileage", "fuel",
  "bodyType", "city", "transmission", "drivetrain", "color", "engineL", "powerHp",
  "description", "sellerPhone", "photos",
];

type Raw = string | number | null | undefined;

const isBlank = (value: Raw) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/** Same acceptance as the server's intField: blank is missing (not 0), Number() coercion, integers only. */
function intInRange(value: Raw, min: number, max: number) {
  if (isBlank(value)) return false;
  const parsed = Number(value ?? "");
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

const ENGINE_LITRES = /^\d{1,2}(\.\d)?$/;

/** Returns litres for a valid value, undefined for blank, or null when invalid. */
export function parseEngineLitres(value: Raw): number | undefined | null {
  if (isBlank(value)) return undefined;
  const text = typeof value === "number"
    ? (Number.isFinite(value) && Math.abs(value * 10 - Math.round(value * 10)) < 1e-9 ? (Math.round(value * 10) / 10).toFixed(1) : "")
    : String(value).trim();
  if (!ENGINE_LITRES.test(text)) return null;
  const parsed = Number(text);
  if (parsed < LISTING_LIMITS.engineMin || parsed > LISTING_LIMITS.engineMax) return null;
  return parsed;
}

function optionalChoice(value: Raw, allowed: readonly string[]) {
  return isBlank(value) || allowed.includes(String(value));
}

export type ListingFieldContext = { make?: Raw; fuel?: Raw; photoCount?: number };

/** One field's error message, or null when the value is acceptable. */
export function validateListingField(field: ListingField, value: Raw, context: ListingFieldContext = {}): string | null {
  switch (field) {
    case "make":
      return (vehicleMakes as readonly string[]).includes(String(value ?? "")) ? null : LISTING_MESSAGES.make;
    case "model": {
      const model = String(value ?? "").trim();
      if (!model || model.length > LISTING_LIMITS.modelMax) return LISTING_MESSAGES.model;
      const make = String(context.make ?? "");
      if (!(vehicleMakes as readonly string[]).includes(make)) return LISTING_MESSAGES.makeBeforeModel;
      return (vehicleMakesAndModels[make as VehicleMake] as readonly string[]).includes(model) ? null : LISTING_MESSAGES.modelForMake;
    }
    case "year":
      return intInRange(value, LISTING_LIMITS.yearMin, listingYearMax()) ? null : LISTING_MESSAGES.year();
    case "price":
      return intInRange(value, LISTING_LIMITS.priceMin, LISTING_LIMITS.priceMax) ? null : LISTING_MESSAGES.price;
    case "mileage":
      return intInRange(value, LISTING_LIMITS.mileageMin, LISTING_LIMITS.mileageMax) ? null : LISTING_MESSAGES.mileage;
    case "fuel":
      return (fuelTypes as readonly string[]).includes(String(value ?? "")) ? null : LISTING_MESSAGES.fuel;
    case "bodyType":
      return optionalChoice(value, bodyTypes) ? null : LISTING_MESSAGES.bodyType;
    case "transmission":
      return optionalChoice(value, transmissions) ? null : LISTING_MESSAGES.transmission;
    case "drivetrain":
      return optionalChoice(value, drivetrains) ? null : LISTING_MESSAGES.drivetrain;
    case "city":
      return optionalChoice(value, albertaCities) ? null : LISTING_MESSAGES.city;
    case "color":
      return optionalChoice(value, COLORS) ? null : LISTING_MESSAGES.color;
    case "engineL":
      if (context.fuel === "Electric") return null;
      return parseEngineLitres(value) === null ? LISTING_MESSAGES.engineL : null;
    case "powerHp":
      return isBlank(value) || intInRange(value, LISTING_LIMITS.powerMin, LISTING_LIMITS.powerMax) ? null : LISTING_MESSAGES.powerHp;
    case "description":
      return isBlank(value) || String(value).trim().length <= LISTING_LIMITS.descriptionMax ? null : LISTING_MESSAGES.description;
    case "sellerPhone":
      return isBlank(value) || String(value).trim().length <= LISTING_LIMITS.phoneMax ? null : LISTING_MESSAGES.sellerPhone;
    case "photos": {
      const count = context.photoCount ?? 0;
      return count >= LISTING_LIMITS.photosMin && count <= LISTING_LIMITS.photosMax ? null : LISTING_MESSAGES.photos;
    }
  }
}

/** All errors for the given fields, keyed by field. Fields absent from `values` are skipped. */
export function validateListingFields(values: Partial<Record<ListingField, Raw>>, context: ListingFieldContext = {}): ListingFieldErrors {
  const errors: ListingFieldErrors = {};
  const ctx = { make: values.make, fuel: values.fuel, ...context };
  for (const field of LISTING_FIELD_ORDER) {
    if (!(field in values) && !(field === "photos" && context.photoCount !== undefined)) continue;
    const message = validateListingField(field, values[field], ctx);
    if (message) errors[field] = message;
  }
  return errors;
}

export function firstInvalidField(errors: ListingFieldErrors): ListingField | null {
  return LISTING_FIELD_ORDER.find((field) => errors[field]) ?? null;
}

export function isListingField(value: unknown): value is ListingField {
  return typeof value === "string" && (LISTING_FIELD_ORDER as readonly string[]).includes(value);
}
