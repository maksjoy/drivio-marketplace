import assert from "node:assert/strict";
import test from "node:test";
import { listingColumns, listingCreateSchema, listingEditSchema } from "../../lib/listing-schema.ts";
import { FEATURE_SLUGS, engineLitreOptions, formatEngineLitres } from "../../lib/listings.ts";

const base = {
  make: "Toyota",
  model: "RAV4",
  year: 2021,
  price: 28000,
  mileage: 40000,
  fuel: "Gasoline",
  bodyType: "Truck/Pickup",
  transmission: "CVT",
  drivetrain: "AWD",
  city: "Calgary",
  color: "Silver",
  engineL: "2.5",
  powerHp: "203",
  description: "One owner.",
  features: ["bluetooth", "cruise_control", "bluetooth"],
};

test("listing writes accept CVT, Truck/Pickup, Bluetooth and cruise control", () => {
  const parsed = listingCreateSchema.safeParse(base);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.deepEqual(parsed.data.features, ["bluetooth", "cruise_control"]);
  const columns = listingColumns(parsed.data);
  assert.equal(columns.transmission, "CVT");
  assert.equal(columns.body_type, "Truck/Pickup");
  assert.equal(columns.engine_l, 2.5);
  assert.equal(columns.engine, "2.5");
  assert.equal(columns.power_hp, 203);
  assert.deepEqual(columns.features, ["bluetooth", "cruise_control"]);
});

test("engine volume uses one decimal and rejects 3.55", () => {
  assert.equal(listingEditSchema.safeParse({ ...base, engineL: "3.55" }).success, false);
  assert.equal(listingEditSchema.safeParse({ ...base, engineL: 3.55 }).success, false);
  assert.equal(listingEditSchema.safeParse({ ...base, engineL: "0.5" }).success, false);
  const parsed = listingEditSchema.safeParse({ ...base, engineL: 2 });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(listingColumns(parsed.data).engine, "2.0");
});

test("edit form text engine input accepts \"2.5\"", () => {
  const parsed = listingEditSchema.safeParse({ ...base, engineL: "2.5" });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.engineL, 2.5);
});

test("electric listings drop engine volume and keep power", () => {
  const parsed = listingCreateSchema.safeParse({ ...base, fuel: "Electric", engineL: "2.5", powerHp: 300 });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.engineL, undefined);
  const columns = listingColumns(parsed.data);
  assert.equal(columns.engine_l, null);
  assert.equal(columns.engine, null);
  assert.equal(columns.power_hp, 300);
});

test("feature cardinality matches the allowlist", () => {
  assert.equal(listingEditSchema.safeParse({ ...base, features: [...FEATURE_SLUGS] }).success, true);
  assert.equal(listingEditSchema.safeParse({ ...base, features: [...FEATURE_SLUGS, "bluetooth"] }).success, false);
});

test("engine display appends litres once", () => {
  assert.equal(formatEngineLitres(3.6), "3.6 L");
  assert.equal(formatEngineLitres("3.6"), "3.6 L");
  assert.equal(formatEngineLitres("3.6 L"), null);
  const options = engineLitreOptions();
  assert.equal(options.length, 80);
  assert.equal(options[0], "0.6");
  assert.equal(options.at(-1), "8.5");
});
