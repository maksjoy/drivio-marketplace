import { createClient } from "@/lib/supabase/server";

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
    if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
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
  if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  if (action === "signup") {
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
