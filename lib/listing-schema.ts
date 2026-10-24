import { z } from "zod";
import {
  albertaCities,
  bodyTypes,
  COLORS,
  drivetrains,
  FEATURE_CARDINALITY_CAP,
  FEATURE_SLUGS,
  fuelTypes,
  transmissions,
  vehicleMakes,
  vehicleMakesAndModels,
  type VehicleMake,
} from "./listings";

const ENGINE_LITRES = /^\d{1,2}(\.\d)?$/;
const makeValues = vehicleMakes as [VehicleMake, ...VehicleMake[]];

function blankToUndefined(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function optionalChoice<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(blankToUndefined, z.enum(values).optional());
}

export const engineLitresField = z.preprocess(blankToUndefined, z.union([z.string(), z.number()]).optional()).transform((value, ctx) => {
  if (value === undefined) return undefined;
  const text = typeof value === "number"
    ? (Number.isFinite(value) && Math.abs(value * 10 - Math.round(value * 10)) < 1e-9 ? (Math.round(value * 10) / 10).toFixed(1) : "")
    : value.trim();
  if (!ENGINE_LITRES.test(text)) {
    ctx.addIssue({ code: "custom", message: "Enter engine volume from 0.6 to 8.5 L." });
    return z.NEVER;
  }
  const parsed = Number(text);
  if (parsed < 0.6 || parsed > 8.5) {
    ctx.addIssue({ code: "custom", message: "Enter engine volume from 0.6 to 8.5 L." });
    return z.NEVER;
  }
  return parsed;
});

export const powerHpField = z.preprocess(
  blankToUndefined,
  z.coerce.number().int().min(40).max(1500).optional(),
);

export const featuresField = z.array(z.enum(FEATURE_SLUGS)).max(FEATURE_CARDINALITY_CAP).transform((values) => {
  const unique: Array<(typeof FEATURE_SLUGS)[number]> = [];
  for (const value of values) {
    if (!unique.includes(value)) unique.push(value);
  }
  return unique;
});

const currentYearUpperBound = () => new Date().getFullYear() + 1;

const listingShape = {
  make: z.enum(makeValues),
  model: z.string().trim().min(1).max(120),
  year: z.coerce.number().int().min(1980).max(currentYearUpperBound()),
  price: z.coerce.number().int().min(500).max(2_000_000),
  mileage: z.coerce.number().int().min(0).max(2_000_000),
  fuel: z.enum(fuelTypes),
  bodyType: optionalChoice(bodyTypes),
  transmission: optionalChoice(transmissions),
  drivetrain: optionalChoice(drivetrains),
  city: optionalChoice(albertaCities),
  color: optionalChoice(COLORS),
  engineL: engineLitresField,
  powerHp: powerHpField,
  description: z.preprocess(blankToUndefined, z.string().trim().max(3000).optional()),
  features: featuresField.optional().transform((values) => values ?? []),
};

function refineListing(value: { make?: VehicleMake; model?: string }, ctx: z.RefinementCtx) {
  if (!value.model) return;
  if (!value.make) {
    ctx.addIssue({ code: "custom", path: ["model"], message: "Choose a make before the model." });
    return;
  }
  const models = vehicleMakesAndModels[value.make] as readonly string[];
  if (!models.includes(value.model)) {
    ctx.addIssue({ code: "custom", path: ["model"], message: "Choose a model for the selected make." });
  }
}

function hideElectricEngine<T extends { fuel?: string; engineL?: number }>(value: T): T {
  if (value.fuel === "Electric") return { ...value, engineL: undefined };
  return value;
}

export const listingCreateSchema = z.object({
  ...listingShape,
  sellerPhone: z.preprocess(blankToUndefined, z.string().trim().max(30).optional()),
}).strict().superRefine(refineListing).transform(hideElectricEngine);

export const listingEditSchema = z.object(listingShape).strict().superRefine(refineListing).transform(hideElectricEngine);

export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
export type ListingEditInput = z.infer<typeof listingEditSchema>;

export function listingColumns(input: ListingEditInput | ListingCreateInput) {
  return {
    make: input.make,
    model: input.model,
    year: input.year,
    price: input.price,
    mileage: input.mileage,
    fuel: input.fuel,
    body_type: input.bodyType ?? null,
    transmission: input.transmission ?? null,
    drivetrain: input.drivetrain ?? null,
    city: input.city ?? null,
    color: input.color ?? null,
    engine_l: input.engineL ?? null,
    engine: input.engineL === undefined ? null : input.engineL.toFixed(1),
    power_hp: input.powerHp ?? null,
    description: input.description ?? null,
    features: input.features,
  };
}
