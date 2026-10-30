import assert from "node:assert/strict";
import test from "node:test";
import { cursorFilter, decodeCursor, encodeCursor } from "../../lib/catalog-cursor.ts";

const id = "f37b9630-d284-4f98-a7d3-2b96b374cdfa";
const createdAt = "2026-09-14T01:22:12.481207+00:00";

function encodeRaw(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

test("round-trips a recent cursor and quotes the filter value", () => {
  const cursor = encodeCursor("recent", { id, created_at: createdAt });
  assert.ok(cursor);
  const decoded = decodeCursor(cursor, "recent");
  assert.deepEqual(decoded, { sort: "recent", value: createdAt, id });
  const filter = cursorFilter(decoded);
  assert.match(filter, /^created_at\.lt\."2026-09-14T01:22:12\.481207\+00:00"/);
  assert.doesNotMatch(filter, /created_at\.lt\.2026/);
  assert.match(filter, new RegExp(`id\\.lt\\."${id}"`));
});

test("round-trips numeric sorts", () => {
  const cursor = encodeCursor("price_asc", { id, price: 19000 });
  const decoded = decodeCursor(cursor, "price_asc");
  assert.deepEqual(decoded, { sort: "price_asc", value: 19000, id });
  assert.match(cursorFilter(decoded), /^price\.gt\."19000",and\(price\.eq\."19000",id\.gt\."/);
});

test("rejects filter injection in a recent cursor", () => {
  const injected = [
    `${createdAt},status.eq.removed`,
    `${createdAt}),id.eq.${id}`,
    "2020-01-01T00:00:00Z,user_id.not.is.null",
    "not-a-date",
    "2026-13-40T00:00:00Z",
    "2026-09-14 01:22:12+00:00",
  ];
  for (const value of injected) {
    assert.equal(decodeCursor(encodeRaw({ sort: "recent", value, id }), "recent"), null, value);
  }
});

test("rejects a cursor whose sort, id, or number is unsafe", () => {
  assert.equal(decodeCursor(encodeRaw({ sort: "price_asc", value: 19000, id }), "recent"), null);
  assert.equal(decodeCursor(encodeRaw({ sort: "recent", value: createdAt, id: "not-a-uuid" }), "recent"), null);
  assert.equal(decodeCursor(encodeRaw({ sort: "recent", value: createdAt, id: `${id},status.eq.removed` }), "recent"), null);
  assert.equal(decodeCursor(encodeRaw({ sort: "price_asc", value: "19000", id }), "price_asc"), null);
  assert.equal(decodeCursor(encodeRaw({ sort: "price_asc", value: 19.5, id }), "price_asc"), null);
  assert.equal(decodeCursor(encodeRaw({ sort: "price_asc", value: -1, id }), "price_asc"), null);
  assert.equal(decodeCursor(encodeRaw({ sort: "year_desc", value: 1979, id }), "year_desc"), null);
  assert.equal(decodeCursor("%%%", "recent"), null);
  assert.equal(decodeCursor("a".repeat(513), "recent"), null);
});
