import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CATALOG_QUERY_BYTE_LIMIT, CATALOG_RANGES, normalizeCatalogRanges, normalizeRangePair, normalizeRangeValue, orderedCatalogQuery } from "../../lib/catalog-params.ts";
import { parseCatalogSearch } from "../../lib/catalog-search.ts";
import { FEATURE_CARDINALITY_CAP, FEATURE_SLUGS, bodyTypes, featureGroups, transmissions } from "../../lib/listings.ts";

test("catalog query byte limit is 2KB", () => {
  assert.equal(CATALOG_QUERY_BYTE_LIMIT, 2048);
});

test("engine bounds share one canonical cache key", () => {
  const bare = parseCatalogSearch(new URLSearchParams("engineMin=2&engineMax=4"));
  const decimal = parseCatalogSearch(new URLSearchParams("engineMin=2.0&engineMax=4.0"));
  assert.equal(bare.ok, true);
  assert.equal(decimal.ok, true);
  assert.equal(bare.canonical, "engineMin=2.0&engineMax=4.0");
  assert.equal(bare.canonical, decimal.canonical);
});

test("rejects values outside the allowlists instead of dropping them", () => {
  for (const query of ["fuel=Petrol", "bodyType=Pickup", "transmission=DCT", "features=not_a_feature", "color=Chrome"]) {
    const result = parseCatalogSearch(new URLSearchParams(query));
    assert.equal(result.ok, false, query);
    assert.equal(result.status, 400);
    assert.equal(result.message, "Invalid search filters.");
    assert.equal("canonical" in result, false);
  }
});

test("accepts CVT, Truck/Pickup, Bluetooth and cruise control", () => {
  const result = parseCatalogSearch(new URLSearchParams("transmission=CVT&bodyType=Truck/Pickup&features=cruise_control,bluetooth"));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.transmission, "CVT");
  assert.deepEqual(result.data.bodyType, ["Truck/Pickup"]);
  assert.deepEqual(result.data.features, ["bluetooth", "cruise_control"]);
  assert.equal(result.canonical, "bodyType=Truck%2FPickup&transmission=CVT&features=bluetooth%2Ccruise_control");
});

test("sorts feature codes by the allowlist and caps a search at 12", () => {
  const ordered = parseCatalogSearch(new URLSearchParams("features=adaptive_cruise,cruise_control"));
  assert.equal(ordered.ok, true);
  if (!ordered.ok) return;
  assert.equal(ordered.canonical, "features=cruise_control%2Cadaptive_cruise");

  const tooMany = FEATURE_SLUGS.slice(0, 13).join(",");
  const rejected = parseCatalogSearch(new URLSearchParams(`features=${tooMany}`));
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, 400);
});

test("rejects unknown keys, duplicates and blanks; swaps inverted ranges", () => {
  assert.equal(parseCatalogSearch(new URLSearchParams("make=Toyota&extra=1")).ok, false);
  const duplicate = new URLSearchParams();
  duplicate.append("make", "Toyota");
  duplicate.append("make", "Honda");
  assert.equal(parseCatalogSearch(duplicate).ok, false);
  assert.equal(parseCatalogSearch(new URLSearchParams("city=")).ok, false);
  const inverted = parseCatalogSearch(new URLSearchParams("priceMin=20&priceMax=10"));
  assert.equal(inverted.ok, true);
  if (inverted.ok) assert.equal(inverted.canonical, "priceMin=10&priceMax=20");
  assert.equal(parseCatalogSearch(new URLSearchParams("model=Civic")).ok, false);
  const valid = parseCatalogSearch(new URLSearchParams("make=Honda&model=Civic&sort=recent"));
  assert.equal(valid.ok, true);
  if (!valid.ok) return;
  assert.equal(valid.canonical, "make=Honda&model=Civic");
});

test("engine search rejects more than one decimal place", () => {
  assert.equal(parseCatalogSearch(new URLSearchParams("engineMin=3.55")).ok, false);
  const belowRange = parseCatalogSearch(new URLSearchParams("engineMin=0.5"));
  assert.equal(belowRange.ok, true);
  if (belowRange.ok) assert.equal(belowRange.canonical, "engineMin=0.6");
  assert.equal(parseCatalogSearch(new URLSearchParams("engineMax=8.5")).ok, true);
});

test("allowlists keep CVT, Truck/Pickup and a 28-slug feature cap", () => {
  assert.deepEqual(transmissions, ["Automatic", "Manual", "CVT"]);
  assert.equal(bodyTypes.includes("Truck/Pickup"), true);
  assert.equal(bodyTypes.includes("Pickup"), false);
  assert.equal(FEATURE_SLUGS.length, 28);
  assert.equal(FEATURE_CARDINALITY_CAP, FEATURE_SLUGS.length);
  assert.equal(FEATURE_SLUGS.includes("bluetooth"), true);
  assert.equal(FEATURE_SLUGS.includes("cruise_control"), true);
  assert.equal(FEATURE_SLUGS.includes("adaptive_cruise"), true);

  const seen = new Map();
  for (const group of featureGroups) {
    for (const slug of group.slugs) {
      assert.equal(seen.has(slug), false, slug);
      seen.set(slug, group.id);
    }
  }
  assert.equal(seen.size, FEATURE_SLUGS.length);
  for (const slug of FEATURE_SLUGS) assert.equal(seen.has(slug), true, slug);
  assert.equal(seen.get("bluetooth"), "tech");
  assert.equal(seen.get("cruise_control"), "safety");
  assert.equal(seen.get("adaptive_cruise"), "safety");
});

test("migration drops and revalidates transmission, renames pickup, and maps the new features", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261024001000_catalog_specs_and_features.sql", import.meta.url), "utf8");
  assert.match(sql, /drop constraint if exists listings_transmission_allowed/);
  assert.match(sql, /transmission in \('Automatic','Manual','CVT'\)/);
  assert.match(sql, /add constraint listings_transmission_allowed[\s\S]*not valid/);
  assert.match(sql, /validate constraint listings_transmission_allowed/);
  assert.match(sql, /body_type = 'Truck\/Pickup'/);
  assert.match(sql, /when 'Bluetooth' then 'bluetooth'/);
  assert.match(sql, /when 'Cruise control' then 'cruise_control'/);
  assert.match(sql, /cardinality\(features\) <= %s/);
  assert.match(sql, /slug_count <> 28/);
});

test("range values drop non-numeric and negative input, round and clamp", () => {
  assert.equal(normalizeRangeValue(CATALOG_RANGES.price, "abc"), "");
  assert.equal(normalizeRangeValue(CATALOG_RANGES.price, "-1"), "");
  assert.equal(normalizeRangeValue(CATALOG_RANGES.mileage, "-5"), "");
  assert.equal(normalizeRangeValue(CATALOG_RANGES.price, "1e5"), "");
  assert.equal(normalizeRangeValue(CATALOG_RANGES.price, " 30000 "), "30000");
  assert.equal(normalizeRangeValue(CATALOG_RANGES.price, "99999999"), "2000000");
  assert.equal(normalizeRangeValue(CATALOG_RANGES.year, "1900"), "1980");
  assert.equal(normalizeRangeValue(CATALOG_RANGES.engine, "3.55"), "3.6");
  assert.equal(normalizeRangeValue(CATALOG_RANGES.engine, "2"), "2.0");
  assert.deepEqual(normalizeRangePair(CATALOG_RANGES.price, "30000", "10000"), ["10000", "30000"]);
  assert.deepEqual(normalizeRangePair(CATALOG_RANGES.year, "2020", "2010"), ["2010", "2020"]);
});

test("QA URLs normalise to queries the API accepts, with no NaN or negative bounds", () => {
  const cases = {
    "priceMin=30000&priceMax=10000": "priceMin=10000&priceMax=30000",
    "mileageMin=-5": "",
    "priceMax=-1": "",
    "yearMin=2020&yearMax=2010": "yearMin=2010&yearMax=2020",
    "priceMin=abc": "",
    "make=Toyota&priceMin=abc&priceMax=20000": "make=Toyota&priceMax=20000",
  };
  for (const [input, expected] of Object.entries(cases)) {
    const query = orderedCatalogQuery(new URLSearchParams(input));
    assert.equal(query, expected, input);
    const parsed = parseCatalogSearch(new URLSearchParams(query));
    assert.equal(parsed.ok, true, input);
    if (parsed.ok) assert.equal(parsed.canonical, expected, input);
    for (const value of new URLSearchParams(query).values()) {
      assert.doesNotMatch(value, /NaN|^-/, input);
    }
  }
  assert.equal(normalizeCatalogRanges(new URLSearchParams("sort=price_asc&priceMin=abc")).toString(), "sort=price_asc");
});

test("server still rejects malformed range syntax sent straight to the API", () => {
  for (const query of ["priceMin=abc", "mileageMin=-5", "priceMax=-1", "engineMin=3.55", "yearMin=20x0"]) {
    const result = parseCatalogSearch(new URLSearchParams(query));
    assert.equal(result.ok, false, query);
    assert.equal(result.status, 400, query);
  }
});
