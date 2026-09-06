import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPriceCAD } from "@/lib/listings";
import { MyListingActions } from "@/components/my-listing-actions";

export const revalidate = 0;

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: listings, error: listingsError }] = await Promise.all([
    supabase.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle(),
    supabase
      .from("listings")
      .select("id, make, model, year, price, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const displayName = profile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "User";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Account</h1>
          <p className="text-sm text-prairie-600">Your profile and vehicle listings.</p>
        </div>
        <Link href="/sell" className="rounded-full bg-rig-700 px-4 py-2 text-sm text-white hover:bg-rig-900">
          Post my car
        </Link>
      </div>

      <section className="mb-8 rounded-2xl border border-prairie-200 bg-white p-5">
        <h2 className="font-semibold">Profile</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-prairie-500">Name</dt><dd>{displayName}</dd>
          <dt className="text-prairie-500">Email</dt><dd>{user.email ?? "—"}</dd>
          <dt className="text-prairie-500">Phone</dt><dd>{profile?.phone || "Not added"}</dd>
        </dl>
      </section>

      <h2 className="mb-4 text-xl font-semibold">My listings</h2>
      {listingsError ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Could not load your listings.</p>
      ) : !listings || listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-prairie-300 bg-white p-8 text-center">
          <p className="text-prairie-600">You haven't posted a car yet.</p>
          <Link href="/sell" className="mt-4 inline-block rounded-full bg-rig-700 px-5 py-2 text-sm text-white">
            Post my car
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <div key={listing.id} className="flex flex-col gap-3 rounded-xl border border-prairie-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <Link href={`/listings/${listing.id}`} className="min-w-0 hover:text-rig-700">
                <p className="font-semibold">{listing.year} {listing.make} {listing.model}</p>
                <p className="text-sm text-prairie-600">
                  {formatPriceCAD(listing.price)} · <span className="text-xs uppercase tracking-wide">{listing.status}</span>
                </p>
              </Link>
              <MyListingActions listingId={listing.id} status={listing.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
