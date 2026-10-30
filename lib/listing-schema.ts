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
import { isListingField, LISTING_LIMITS, LISTING_MESSAGES, listingYearMax, parseEngineLitres, type ListingField } from "./listing-rules";

const makeValues = vehicleMakes as [VehicleMake, ...VehicleMake[]];

function blankToUndefined(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function optionalChoice<const T extends readonly [string, ...string[]]>(values: T, message: string) {
  return z.preprocess(blankToUndefined, z.enum(values, { error: message }).optional());
}

// Messages and limits come from lib/listing-rules.ts so the forms show the server's wording.
// Blank is missing, not 0: z.coerce.number("") is 0, which let an empty mileage through as 0 km.
function intField(min: number, max: number, message: string) {
  return z.preprocess(blankToUndefined, z.coerce.number({ error: message }).int({ error: message }).min(min, { error: message }).max(max, { error: message }));
}

export const engineLitresField = z.preprocess(blankToUndefined, z.union([z.string(), z.number()], { error: LISTING_MESSAGES.engineL }).optional()).transform((value, ctx) => {
  const parsed = parseEngineLitres(value);
  if (parsed === null) {
    ctx.addIssue({ code: "custom", message: LISTING_MESSAGES.engineL });
    return z.NEVER;
  }
  return parsed;
});

export const powerHpField = z.preprocess(
  blankToUndefined,
  intField(LISTING_LIMITS.powerMin, LISTING_LIMITS.powerMax, LISTING_MESSAGES.powerHp).optional(),
);

export const featuresField = z.array(z.enum(FEATURE_SLUGS)).max(FEATURE_CARDINALITY_CAP).transform((values) => {
  const unique: Array<(typeof FEATURE_SLUGS)[number]> = [];
  for (const value of values) {
    if (!unique.includes(value)) unique.push(value);
  }
  return unique;
});

const listingShape = {
  make: z.enum(makeValues, { error: LISTING_MESSAGES.make }),
  model: z.string({ error: LISTING_MESSAGES.model }).trim().min(1, { error: LISTING_MESSAGES.model }).max(LISTING_LIMITS.modelMax, { error: LISTING_MESSAGES.model }),
  year: intField(LISTING_LIMITS.yearMin, listingYearMax(), LISTING_MESSAGES.year()),
  price: intField(LISTING_LIMITS.priceMin, LISTING_LIMITS.priceMax, LISTING_MESSAGES.price),
  mileage: intField(LISTING_LIMITS.mileageMin, LISTING_LIMITS.mileageMax, LISTING_MESSAGES.mileage),
  fuel: z.enum(fuelTypes, { error: LISTING_MESSAGES.fuel }),
  bodyType: optionalChoice(bodyTypes, LISTING_MESSAGES.bodyType),
  transmission: optionalChoice(transmissions, LISTING_MESSAGES.transmission),
  drivetrain: optionalChoice(drivetrains, LISTING_MESSAGES.drivetrain),
  city: optionalChoice(albertaCities, LISTING_MESSAGES.city),
  color: optionalChoice(COLORS, LISTING_MESSAGES.color),
  engineL: engineLitresField,
  powerHp: powerHpField,
  description: z.preprocess(blankToUndefined, z.string().trim().max(LISTING_LIMITS.descriptionMax, { error: LISTING_MESSAGES.description }).optional()),
  features: featuresField.optional().transform((values) => values ?? []),
};

function refineListing(value: { make?: VehicleMake; model?: string }, ctx: z.RefinementCtx) {
  if (!value.model) return;
  if (!value.make) {
    ctx.addIssue({ code: "custom", path: ["model"], message: LISTING_MESSAGES.makeBeforeModel });
    return;
  }
  const models = vehicleMakesAndModels[value.make] as readonly string[];
  if (!models.includes(value.model)) {
    ctx.addIssue({ code: "custom", path: ["model"], message: LISTING_MESSAGES.modelForMake });
  }
}

function hideElectricEngine<T extends { fuel?: string; engineL?: number }>(value: T): T {
  if (value.fuel === "Electric") return { ...value, engineL: undefined };
  return value;
}

export const listingCreateSchema = z.object({
  ...listingShape,
  sellerPhone: z.preprocess(blankToUndefined, z.string().trim().max(LISTING_LIMITS.phoneMax, { error: LISTING_MESSAGES.sellerPhone }).optional()),
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

/** 400 body for a failed listing parse: the first message, plus the form field it belongs to. */
export function listingValidationError(issues: readonly { message: string; path: readonly PropertyKey[] }[]): { error: string; field?: ListingField } {
  const issue = issues[0];
  if (!issue) return { error: "Check the listing details." };
  const field = issue.path[0];
  return isListingField(field) ? { error: issue.message, field } : { error: issue.message };
}
