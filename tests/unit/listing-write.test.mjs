import assert from "node:assert/strict";
import test from "node:test";
import { listingWriteError } from "../../lib/listing-write.ts";

test("check violations become a generic 400", () => {
  const result = listingWriteError({
    code: "23514",
    message: 'new row for relation "listings" violates check constraint "listings_transmission_allowed"',
  });
  assert.deepEqual(result, { status: 400, message: "Check the listing details." });
  assert.equal(result.message.includes("listings_transmission_allowed"), false);
  assert.equal(JSON.stringify(result).includes("23514"), false);
});

test("constraint wording without a code is still generic", () => {
  const result = listingWriteError({ message: "check constraint listings_features_allowed failed" });
  assert.equal(result.status, 400);
  assert.equal(result.message, "Check the listing details.");
  assert.equal(result.message.includes("listings_features_allowed"), false);
});
