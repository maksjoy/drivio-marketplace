import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "@/lib/csp";
import { csrfBlocked } from "@/lib/csrf";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  if (csrfBlocked({
    method: request.method,
    pathname: request.nextUrl.pathname,
    originHeader: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    requestOrigin: request.nextUrl.origin,
    hostHeader: request.headers.get("x-forwarded-host") || request.headers.get("host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
  })) {
    return NextResponse.json(
      { error: "Cross-site request blocked." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === "development";
  const csp = contentSecurityPolicy({
    nonce,
    dev,
    supabaseUrl: SUPABASE_URL,
    protocol: request.nextUrl.protocol,
    forwardedProto: request.headers.get("x-forwarded-proto"),
    hostname: request.nextUrl.hostname,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: !dev,
            sameSite: "lax",
            path: "/",
          }));
        },
      },
    },
  );

  await supabase.auth.getUser();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Public catalog responses must bypass auth/session middleware so Vercel can cache them at the CDN.
  matcher: ["/((?!api/catalog|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
