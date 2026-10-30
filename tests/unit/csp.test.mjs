import assert from "node:assert/strict";
import test from "node:test";
import { contentSecurityPolicy } from "../../lib/csp.ts";

const supabaseUrl = "https://rjoipowznfokhvahuozf.supabase.co";
const nonce = "test-nonce";

const shared = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
  "style-src 'self'",
  `img-src 'self' data: blob: ${supabaseUrl}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
];

function policy(signals) {
  return contentSecurityPolicy({
    nonce,
    dev: false,
    supabaseUrl,
    ...signals,
  });
}

test("includes upgrade-insecure-requests for HTTPS requests on a public host", () => {
  const expected = [...shared, "upgrade-insecure-requests"].join("; ");
  const viaUrl = policy({
    protocol: "https:",
    forwardedProto: null,
    hostname: "p2pcars-alberta.vercel.app",
  });
  const viaForwarded = policy({
    protocol: "http:",
    forwardedProto: "HTTPS",
    hostname: "p2pcars-alberta.vercel.app",
  });
  assert.equal(viaUrl, expected);
  assert.equal(viaForwarded, expected);
  assert.equal(viaUrl.includes("upgrade-insecure-requests"), true);
});

test("omits upgrade-insecure-requests for HTTP CI and loopback hosts", () => {
  const expected = shared.join("; ");
  const cases = [
    { protocol: "http:", forwardedProto: null, hostname: "127.0.0.1" },
    { protocol: "http:", forwardedProto: "http", hostname: "127.0.0.1" },
    { protocol: "https:", forwardedProto: "https", hostname: "127.0.0.1" },
    { protocol: "https:", forwardedProto: "https", hostname: "localhost" },
    { protocol: "http:", forwardedProto: "https", hostname: "localhost" },
    { protocol: "http:", forwardedProto: null, hostname: "p2pcars-alberta.vercel.app" },
    { protocol: "http:", forwardedProto: "http", hostname: "p2pcars-alberta.vercel.app" },
  ];
  for (const signals of cases) {
    const value = policy(signals);
    assert.equal(value, expected);
    assert.equal(value.includes("upgrade-insecure-requests"), false);
  }
  assert.equal(`${expected}; upgrade-insecure-requests`, [...shared, "upgrade-insecure-requests"].join("; "));
});
