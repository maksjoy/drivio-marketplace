import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MyListingRow } from "@/components/my-listing-row";

// Same "Page — Alberta-Cars" pattern as /contact and listing pages.
export const metadata: Metadata = { title: "Account — Alberta-Cars" };

export const revalidate = 0;

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: identity }, { data: listings, error: listingsError }, { data: admin }] = await Promise.all([
    supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
    supabase.from("public_identities").select("nickname").eq("user_id", user.id).maybeSingle(),
    supabase.from("listings").select("id, make, model, year, price, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">Account</h1><p className="text-sm text-muted">Your private profile, messages and vehicle listings.</p></div>
        <div className="flex flex-wrap gap-2">
          <Link href="/messages" className="rounded-full border border-success/40 bg-success-soft px-4 py-2 text-sm font-bold text-success-strong">Messages</Link>
          {admin && <Link href="/admin" className="rounded-full border border-line-strong px-4 py-2 text-sm font-semibold">Admin</Link>}
          <Link href="/sell" className="rounded-full bg-primary px-4 py-2 text-sm text-white hover:bg-primary-strong">Post my car</Link>
        </div>
      </div>

      <section className="mb-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Profile</h2>
        <div className="mt-3 rounded-xl bg-success-soft p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-success">Your public nickname</p>
          <p className="mt-1 text-xl font-extrabold text-ink">{identity?.nickname || "Anonymous User"}</p>
          <p className="mt-1 text-xs text-muted">This is the only name buyers and sellers see on Alberta Cars.</p>
        </div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted">Private email</dt><dd>{user.email ?? "—"}</dd>
          <dt className="text-muted">Private phone</dt><dd>{profile?.phone || "Not added"}</dd>
        </dl>
        <p className="mt-3 rounded-xl bg-surface-sunken p-3 text-xs leading-5 text-muted">Your email and phone are never shown on a public listing. Buyers contact you through Alberta Cars Messages; you decide if and when to share your phone number.</p>
      </section>

      <h2 className="mb-4 text-xl font-semibold">My listings</h2>
      {listingsError ? (
        <p className="rounded-xl bg-danger-soft p-4 text-sm text-danger">Could not load your listings.</p>
      ) : !listings || listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-white p-8 text-center">
          <p className="text-muted">You haven't posted a car yet.</p>
          <Link href="/sell" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm text-white">Post my car</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <MyListingRow key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
