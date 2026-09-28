import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

type AuthSettings = {
  external?: Record<string, boolean | undefined>;
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn("Could not read Supabase auth provider settings", response.status);
      return Response.json({ google: false, apple: false });
    }

    const settings = (await response.json().catch(() => ({}))) as AuthSettings;
    return Response.json({
      google: settings.external?.google === true,
      apple: settings.external?.apple === true,
    });
  } catch (error) {
    console.warn("Could not read Supabase auth provider settings", error);
    return Response.json({ google: false, apple: false });
  }
}
