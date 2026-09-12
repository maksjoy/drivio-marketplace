import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

const secureCookie = (options: CookieOptions): CookieOptions => ({
  ...options,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

// Server-only Supabase client. Browser code never receives access/refresh tokens.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...secureCookie(options) });
          } catch {
            // Server Components cannot always mutate cookies. Middleware refreshes sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...secureCookie(options), maxAge: 0 });
          } catch {
            // See note above.
          }
        },
      },
    },
  );
}
