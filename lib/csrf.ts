const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type CsrfRequest = {
  method: string;
  pathname: string;
  originHeader: string | null;
  secFetchSite: string | null;
  requestOrigin: string;
  // Browser Origin is compared to both the framework URL and the Host the
  // client actually used. Next can rewrite 127.0.0.1 to localhost locally.
  hostHeader?: string | null;
  forwardedProto?: string | null;
};

/**
 * Same-origin check for state-changing /api requests.
 * A missing Origin is allowed only when the browser reports Sec-Fetch-Site
 * as same-origin or none. Requests with neither header are rejected so a
 * classic cross-site form post cannot pass.
 */
export function csrfBlocked(request: CsrfRequest): boolean {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return false;
  if (!request.pathname.startsWith("/api/")) return false;

  const fetchSite = request.secFetchSite?.trim().toLowerCase() || null;
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;

  const originHeader = request.originHeader?.trim() || null;
  if (!originHeader) return fetchSite !== "same-origin" && fetchSite !== "none";

  let origin: string;
  try {
    origin = new URL(originHeader).origin;
  } catch {
    return true;
  }
  return !allowedOrigins(request).has(origin);
}

function allowedOrigins(request: CsrfRequest) {
  const allowed = new Set<string>();
  try {
    const base = new URL(request.requestOrigin);
    allowed.add(base.origin);
    const host = firstHeaderValue(request.hostHeader);
    if (host) {
      const proto = firstHeaderValue(request.forwardedProto) || base.protocol.replace(":", "");
      allowed.add(new URL(`${proto}://${host}`).origin);
    }
  } catch {
    // A malformed base URL fails closed when Origin is present and unmatched.
  }
  return allowed;
}

function firstHeaderValue(value: string | null | undefined) {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}
