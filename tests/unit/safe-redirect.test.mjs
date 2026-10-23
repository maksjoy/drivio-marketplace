import assert from "node:assert/strict";
import test from "node:test";
import { safeRedirectPath } from "../../lib/safe-redirect.ts";

const origin = "https://p2pcars.example";

test("keeps same-origin paths and query strings", () => {
  assert.equal(safeRedirectPath("/account", origin), "/account");
  assert.equal(safeRedirectPath("/listings/abc?sort=recent", origin), "/listings/abc?sort=recent");
  assert.equal(safeRedirectPath("/", origin), "/");
});

test("accepts a same-origin absolute URL as its path", () => {
  assert.equal(safeRedirectPath("https://p2pcars.example/reset-password?ok=1", origin), "/reset-password?ok=1");
});

test("rejects missing, empty, and non-path targets", () => {
  assert.equal(safeRedirectPath(null, origin), "/");
  assert.equal(safeRedirectPath(undefined, origin), "/");
  assert.equal(safeRedirectPath("", origin), "/");
  assert.equal(safeRedirectPath("https://evil.com", origin), "/");
  assert.equal(safeRedirectPath("//evil.com", origin), "/");
  assert.equal(safeRedirectPath("///evil.com", origin), "/");
  assert.equal(safeRedirectPath("javascript:alert(1)", origin), "/");
  assert.equal(safeRedirectPath("http://p2pcars.example/account", origin), "/");
});

test("rejects backslash and control-character open redirects", () => {
  assert.equal(safeRedirectPath("/\\evil.com", origin), "/");
  assert.equal(safeRedirectPath("/\\\\evil.com", origin), "/");
  assert.equal(safeRedirectPath("\\\\evil.com", origin), "/");
  assert.equal(safeRedirectPath("/foo\\bar", origin), "/");
  assert.equal(safeRedirectPath("/%09/evil.com", origin), "/");
  assert.equal(safeRedirectPath("/%5c/evil.com", origin), "/");
  assert.equal(safeRedirectPath("/%5Cevil.com", origin), "/");
  assert.equal(safeRedirectPath("/\t/evil.com", origin), "/");
  assert.equal(safeRedirectPath("/\n/evil.com", origin), "/");
  assert.equal(safeRedirectPath("/\r/evil.com", origin), "/");
  assert.equal(safeRedirectPath("/foo%0aSet-Cookie:x", origin), "/");
});
