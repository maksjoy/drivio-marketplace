import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

async function validateNewPassword(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Password must be no more than ${PASSWORD_MAX_LENGTH} characters.`;

  const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  let response: Response;
  try {
    response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "P2PCars.ca password screening",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("Password breach screening request failed", error);
    return "Password security check is temporarily unavailable. Please try again.";
  }

  if (!response.ok) {
    console.error("Password breach screening returned", response.status);
    return "Password security check is temporarily unavailable. Please try again.";
  }

  const matches = (await response.text()).split(/\r?\n/);
  const compromised = matches.some((line) => {
    const [candidateSuffix, count] = line.trim().split(":", 2);
    return candidateSuffix === suffix && Number(count || 0) > 0;
  });

  if (compromised) return "Choose a different password. This password has appeared in a known data breach.";
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "signout") {
    await supabase.auth.signOut();
    return Response.json({ ok: true });
  }

  if (action === "update_password") {
    const password = String(body.password || "");
    const passwordError = await validateNewPassword(password);
    if (passwordError) return Response.json({ error: passwordError }, { status: passwordError.includes("temporarily unavailable") ? 503 : 400 });
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return Response.json({ error: "Enter a valid email." }, { status: 400 });

  if (action === "recover") {
    const origin = new URL(request.url).origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }

  const password = String(body.password || "");
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return Response.json({ error: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.` }, { status: 400 });
  }

  if (action === "signup") {
    const passwordError = await validateNewPassword(password);
    if (passwordError) return Response.json({ error: passwordError }, { status: passwordError.includes("temporarily unavailable") ? 503 : 400 });
    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true, signedIn: Boolean(data.session) });
  }

  if (action === "signin") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return Response.json({ error: "Incorrect email or password." }, { status: 401 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unsupported authentication action." }, { status: 400 });
}
