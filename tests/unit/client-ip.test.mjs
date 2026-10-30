import assert from "node:assert/strict";
import test from "node:test";
import { clientIpFromHeaders } from "../../lib/client-ip.ts";

function headers(values) {
  return new Headers(values);
}

test("prefers the single Vercel x-real-ip over every forwarded header", () => {
  const ip = clientIpFromHeaders(headers({
    "x-real-ip": "203.0.113.10",
    "x-vercel-forwarded-for": "198.51.100.8, 10.0.0.1",
    "x-forwarded-for": "1.2.3.4, 203.0.113.10",
  }));
  assert.equal(ip, "203.0.113.10");
});

test("uses the first x-vercel-forwarded-for address when x-real-ip is missing", () => {
  const ip = clientIpFromHeaders(headers({
    "x-vercel-forwarded-for": "2001:db8::1, 10.0.0.1",
    "x-forwarded-for": "198.51.100.20",
  }));
  assert.equal(ip, "2001:db8::1");
});

test("ignores a client-supplied x-forwarded-for list", () => {
  assert.equal(clientIpFromHeaders(headers({ "x-forwarded-for": "198.51.100.20, 203.0.113.10" })), "unknown");
});

test("rejects a list-shaped x-real-ip instead of trusting its first value", () => {
  assert.equal(clientIpFromHeaders(headers({ "x-real-ip": "1.2.3.4, 203.0.113.10" })), "unknown");
  assert.equal(
    clientIpFromHeaders(headers({
      "x-real-ip": "1.2.3.4, 203.0.113.10",
      "x-vercel-forwarded-for": "198.51.100.8",
    })),
    "198.51.100.8",
  );
});

test("falls back to the shared unknown bucket for missing or malformed addresses", () => {
  assert.equal(clientIpFromHeaders(headers({})), "unknown");
  assert.equal(clientIpFromHeaders(headers({ "x-real-ip": "999.1.1.1" })), "unknown");
  assert.equal(clientIpFromHeaders(headers({ "x-real-ip": "203.0.113.10:443" })), "unknown");
  assert.equal(clientIpFromHeaders(headers({ "x-real-ip": "  " })), "unknown");
});

test("accepts a compressed IPv6 address and a v4-mapped address", () => {
  assert.equal(clientIpFromHeaders(headers({ "x-real-ip": "::1" })), "::1");
  assert.equal(clientIpFromHeaders(headers({ "x-real-ip": "::ffff:192.0.2.1" })), "::ffff:192.0.2.1");
});
