import assert from "node:assert/strict";
import test from "node:test";
import { csrfBlocked } from "../../lib/csrf.ts";

const requestOrigin = "https://p2pcars.example";

function check(overrides) {
  return csrfBlocked({
    method: "POST",
    pathname: "/api/auth",
    originHeader: requestOrigin,
    secFetchSite: "same-origin",
    requestOrigin,
    ...overrides,
  });
}

test("ignores safe methods and non-API routes", () => {
  assert.equal(check({ method: "GET", originHeader: null, secFetchSite: null }), false);
  assert.equal(check({ method: "HEAD", pathname: "/api/listings", originHeader: "https://evil.com" }), false);
  assert.equal(check({ pathname: "/auth/callback", originHeader: null, secFetchSite: null }), false);
  assert.equal(check({ pathname: "/login", originHeader: null, secFetchSite: "cross-site" }), false);
});

test("allows same-origin browser requests", () => {
  assert.equal(check({}), false);
  assert.equal(check({ method: "DELETE", pathname: "/api/listings/abc", secFetchSite: null }), false);
  assert.equal(check({ originHeader: null, secFetchSite: "same-origin" }), false);
  assert.equal(check({ originHeader: null, secFetchSite: "none" }), false);
});

test("accepts the browser host when the framework origin differs", () => {
  assert.equal(check({
    originHeader: "http://127.0.0.1:3456",
    requestOrigin: "http://localhost:3456",
    hostHeader: "127.0.0.1:3456",
    secFetchSite: "same-origin",
  }), false);
  assert.equal(check({
    originHeader: "https://p2pcars.example",
    requestOrigin: "http://localhost:3000",
    hostHeader: "p2pcars.example",
    forwardedProto: "https",
    secFetchSite: "same-origin",
  }), false);
});

test("blocks cross-site and headerless unsafe API requests", () => {
  assert.equal(check({ originHeader: "https://evil.com", secFetchSite: "cross-site" }), true);
  assert.equal(check({ originHeader: "https://evil.com", secFetchSite: null }), true);
  assert.equal(check({ originHeader: null, secFetchSite: null }), true);
  assert.equal(check({ originHeader: null, secFetchSite: "cross-site" }), true);
  assert.equal(check({ originHeader: null, secFetchSite: "same-site" }), true);
  assert.equal(check({ originHeader: "null", secFetchSite: "cross-site" }), true);
  assert.equal(check({ originHeader: requestOrigin, secFetchSite: "same-site" }), true);
  assert.equal(check({ originHeader: "https://p2pcars.example.evil.com" }), true);
  assert.equal(check({ originHeader: "http://p2pcars.example" }), true);
});
