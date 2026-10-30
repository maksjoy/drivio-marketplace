import assert from "node:assert/strict";
import test from "node:test";
import { canonicalCatalogParams, orderedCatalogQuery } from "../../lib/catalog-params.ts";
import { parseCatalogSearch } from "../../lib/catalog-search.ts";
import { COLORS, FEATURE_SLUGS, albertaCities, bodyTypes, drivetrains, fuelTypes, transmissions, vehicleMakes } from "../../lib/listings.ts";

const ALLOWLISTS = { bodyType: bodyTypes, fuel: fuelTypes, transmission: transmissions, drivetrain: drivetrains, color: COLORS, features: FEATURE_SLUGS, make: vehicleMakes, city: albertaCities };

test("server stays strict about casing and unknown values", () => {
  for (const query of ["transmission=cvt", "transmission=automatic", "bodyType=suv", "features=bogus", "features=Heated_Seats"]) {
    assert.equal(parseCatalogSearch(new URLSearchParams(query)).ok, false, query);
  }
});

test("every allowlisted value the UI can send is accepted exactly as written", () => {
  for (const [key, values] of Object.entries(ALLOWLISTS)) {
    for (const value of values) {
      const query = orderedCatalogQuery(new URLSearchParams({ [key]: value }));
      assert.equal(parseCatalogSearch(new URLSearchParams(query)).ok, true, query);
    }
  }
});

test("browser canonicalises casing and drops unknown values before calling the API", () => {
  const cases = [
    ["transmission=cvt", "transmission=CVT"],
    ["transmission=AUTOMATIC", "transmission=Automatic"],
    ["bodyType=suv,sedan", "bodyType=Sedan%2CSUV"],
    ["features=Heated_Seats,bogus", "features=heated_seats"],
    ["features=bogus", ""],
    ["drivetrain=awd,4wd", "drivetrain=AWD%2C4WD"],
    ["make=toyota&model=camry", "make=Toyota&model=Camry"],
    ["make=Toyota&model=nope", "make=Toyota"],
    ["sort=PRICE_ASC", "sort=price_asc"],
    ["sort=bogus", ""],
  ];
  for (const [input, expected] of cases) {
    const canonical = orderedCatalogQuery(canonicalCatalogParams(new URLSearchParams(input)));
    assert.equal(canonical, expected, input);
    assert.equal(parseCatalogSearch(new URLSearchParams(canonical)).ok, true, input);
  }
});
