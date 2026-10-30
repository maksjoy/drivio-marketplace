export type CspRequestSignals = {
  protocol: string;
  forwardedProto?: string | null;
  hostname: string;
};

export type ContentSecurityPolicyOptions = CspRequestSignals & {
  nonce: string;
  dev: boolean;
  supabaseUrl: string;
};

function forwardedProto(value: string | null | undefined): string | null {
  const first = value?.split(",")[0]?.trim().toLowerCase().replace(/:$/, "");
  return first || null;
}

/** True when the URL or the edge's x-forwarded-proto says the request is HTTPS. */
export function requestIsHttps(signals: Pick<CspRequestSignals, "protocol" | "forwardedProto">): boolean {
  const forwarded = forwardedProto(signals.forwardedProto);
  return signals.protocol === "https:" || forwarded === "https";
}

/** Loopback hosts where upgrade-insecure-requests rewrites local HTTP assets to HTTPS. */
export function isLoopbackHost(hostname: string): boolean {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    host = end === -1 ? host : host.slice(1, end);
  } else if (host.includes(":") && !host.includes("::")) {
    host = host.slice(0, host.indexOf(":"));
  }
  host = host.replace(/\.$/, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function shouldUpgradeInsecureRequests(signals: CspRequestSignals): boolean {
  return requestIsHttps(signals) && !isLoopbackHost(signals.hostname);
}

/** Cloudflare Turnstile loads its script, iframe, and API calls from this origin. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export function contentSecurityPolicy(options: ContentSecurityPolicyOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic' ${TURNSTILE_ORIGIN}${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self'",
    `img-src 'self' data: blob: ${options.supabaseUrl}`,
    "font-src 'self' data:",
    `connect-src 'self' ${options.supabaseUrl} https://*.ingest.sentry.io https://*.ingest.us.sentry.io ${TURNSTILE_ORIGIN}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ];
  if (shouldUpgradeInsecureRequests(options)) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}
