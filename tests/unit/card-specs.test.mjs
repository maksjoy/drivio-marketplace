import assert from "node:assert/strict";
import test from "node:test";

import { CARD_SPEC_LIMIT, cardSpecs } from "../../lib/card-specs.ts";

const base = { mileage: 189000, transmission: "Automatic", drivetrain: "AWD", fuel: "Gasoline", engine: "3.6" };

test("card specs follow the approved order: mileage, transmission, drivetrain", () => {
  assert.deepEqual(cardSpecs(base), ["189,000 km", "Automatic", "AWD"]);
  assert.equal(CARD_SPEC_LIMIT, 3);
});

test("a missing spec is backfilled with fuel, then engine", () => {
  assert.deepEqual(cardSpecs({ ...base, drivetrain: null }), ["189,000 km", "Automatic", "Gasoline"]);
  assert.deepEqual(cardSpecs({ ...base, transmission: "" }), ["189,000 km", "AWD", "Gasoline"]);
  assert.deepEqual(cardSpecs({ ...base, drivetrain: null, fuel: null }), ["189,000 km", "Automatic", "3.6 L"]);
  assert.deepEqual(cardSpecs({ ...base, transmission: null, drivetrain: null }), ["189,000 km", "Gasoline", "3.6 L"]);
  assert.deepEqual(cardSpecs({ mileage: 5000 }), ["5,000 km"]);
});

test("electric cars show 'Electric' instead of the transmission, without repeating fuel", () => {
  assert.deepEqual(cardSpecs({ ...base, fuel: "Electric", transmission: "Automatic", engine: null }), ["189,000 km", "Electric", "AWD"]);
  assert.deepEqual(cardSpecs({ ...base, fuel: "Electric", transmission: null, drivetrain: null, engine: null }), ["189,000 km", "Electric"]);
  assert.deepEqual(cardSpecs({ ...base, fuel: "Electric", drivetrain: "" }), ["189,000 km", "Electric", "3.6 L"]);
});

test("never more than three specs and no blanks", () => {
  const specs = cardSpecs({ ...base, transmission: "  ", drivetrain: "RWD" });
  assert.ok(specs.length <= CARD_SPEC_LIMIT);
  assert.ok(specs.every((value) => value.trim() !== "" && value !== "—"));
});
