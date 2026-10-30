import assert from "node:assert/strict";
import test from "node:test";
import { listingCreateSchema, listingEditSchema, listingValidationError } from "../../lib/listing-schema.ts";
import {
  LISTING_MESSAGES,
  firstInvalidField,
  listingYearMax,
  validateListingField,
  validateListingFields,
} from "../../lib/listing-rules.ts";

const base = {
  make: "Toyota", model: "RAV4", year: "2021", price: "28000", mileage: "40000", fuel: "Gasoline",
  bodyType: "", transmission: "", drivetrain: "", city: "", color: "", engineL: "", powerHp: "",
  description: "", features: [], sellerPhone: "",
};

const year = listingYearMax();
// [field, value, expected message or null]
const cases = [
  ["engineL", "-1", LISTING_MESSAGES.engineL],
  ["engineL", "abc", LISTING_MESSAGES.engineL],
  ["engineL", "99", LISTING_MESSAGES.engineL],
  ["engineL", "0.5", LISTING_MESSAGES.engineL],
  ["engineL", "8.6", LISTING_MESSAGES.engineL],
  ["engineL", "3.55", LISTING_MESSAGES.engineL],
  ["engineL", "2.5", null],
  ["engineL", " 8.5 ", null],
  ["engineL", "", null],
  ["powerHp", "39", LISTING_MESSAGES.powerHp],
  ["powerHp", "1501", LISTING_MESSAGES.powerHp],
  ["powerHp", "150.5", LISTING_MESSAGES.powerHp],
  ["powerHp", "abc", LISTING_MESSAGES.powerHp],
  ["powerHp", "40", null],
  ["powerHp", "1500", null],
  ["powerHp", "", null],
  ["year", String(year + 1), LISTING_MESSAGES.year()],
  ["year", "1979", LISTING_MESSAGES.year()],
  ["year", "", LISTING_MESSAGES.year()],
  ["year", "2020.5", LISTING_MESSAGES.year()],
  ["year", String(year), null],
  ["year", "1980", null],
  ["price", "499", LISTING_MESSAGES.price],
  ["price", "2000001", LISTING_MESSAGES.price],
  ["price", "", LISTING_MESSAGES.price],
  ["price", "500", null],
  ["mileage", "-1", LISTING_MESSAGES.mileage],
  ["mileage", "2000001", LISTING_MESSAGES.mileage],
  ["mileage", "0", null],
  // Blank mileage is missing, not 0 km (z.coerce.number("") is 0; the forms are noValidate).
  ["mileage", "", LISTING_MESSAGES.mileage],
  ["mileage", "   ", LISTING_MESSAGES.mileage],
  ["price", "  ", LISTING_MESSAGES.price],
  ["powerHp", "  ", null],
  ["make", "", LISTING_MESSAGES.make],
  ["make", "Yugo", LISTING_MESSAGES.make],
  ["model", "", LISTING_MESSAGES.model],
  ["model", "Civic", LISTING_MESSAGES.modelForMake],
  ["fuel", "", LISTING_MESSAGES.fuel],
  ["fuel", "Steam", LISTING_MESSAGES.fuel],
  ["transmission", "cvt", LISTING_MESSAGES.transmission],
  ["transmission", "CVT", null],
  ["description", "x".repeat(3001), LISTING_MESSAGES.description],
  ["description", "x".repeat(3000), null],
  ["sellerPhone", "1".repeat(31), LISTING_MESSAGES.sellerPhone],
  ["sellerPhone", "403-555-0100", null],
];

for (const [field, value, expected] of cases) {
  test(`client and server agree: ${field}=${JSON.stringify(value.length > 20 ? `${value.slice(0, 8)}…(${value.length})` : value)}`, () => {
    const client = validateListingField(field, value, { make: base.make, fuel: base.fuel });
    assert.equal(client, expected);
    const parsed = listingCreateSchema.safeParse({ ...base, [field]: value });
    if (expected === null) {
      assert.equal(parsed.success, true, parsed.success ? "" : parsed.error.issues[0]?.message);
    } else {
      assert.equal(parsed.success, false);
      assert.equal(parsed.error.issues[0]?.message, expected);
      assert.deepEqual(listingValidationError(parsed.error.issues), { error: expected, field });
    }
  });
}

test("edit schema uses the same messages", () => {
  const { sellerPhone, ...editBase } = base;
  const parsed = listingEditSchema.safeParse({ ...editBase, engineL: "99" });
  assert.equal(parsed.success, false);
  assert.deepEqual(listingValidationError(parsed.error.issues), { error: "Enter engine volume from 0.6 to 8.5 L.", field: "engineL" });
});

test("engine is not validated for Electric (the field is hidden and dropped)", () => {
  assert.equal(validateListingField("engineL", "99", { fuel: "Electric" }), null);
});

test("validateListingFields returns errors in on-screen order, with photos last", () => {
  const errors = validateListingFields({ ...base, price: "100", engineL: "abc", year: "1900" }, { photoCount: 0 });
  assert.deepEqual(Object.keys(errors), ["year", "price", "engineL", "photos"]);
  assert.equal(firstInvalidField(errors), "year");
  assert.equal(errors.photos, LISTING_MESSAGES.photos);
  assert.deepEqual(validateListingFields(base, { photoCount: 3 }), {});
  assert.equal(validateListingFields(base, { photoCount: 9 }).photos, LISTING_MESSAGES.photos);
});

test("listing-rules stays free of zod (it ships to the client, where Zod's eval probe breaks the CSP)", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../../lib/listing-rules.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["']zod/);
});
