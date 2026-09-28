import type { Provider } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedProviders = new Set<Provider>(["google", "apple"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedProvider = url.searchParams.get("provider") as Provider | null;
  const requestedNext = url.searchParams.get("next") || "/";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";

  if (!requestedProvider || !allowedProviders.has(requestedProvider)) {
    return NextResponse.redirect(new URL("/login?error=provider", url.origin));
  }

  const supabase = await createClient();
  const callback = new URL("/auth/callback", url.origin);
  callback.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: requestedProvider,
    options: {
      redirectTo: callback.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error("OAuth sign-in could not start", requestedProvider, error?.message);
    const failure = new URL("/login", url.origin);
    failure.searchParams.set("error", `oauth_${requestedProvider}`);
    if (next !== "/") failure.searchParams.set("next", next);
    return NextResponse.redirect(failure);
  }

  return NextResponse.redirect(data.url);
}
