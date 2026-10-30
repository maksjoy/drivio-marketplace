import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/database";
import { createClient } from "@/lib/supabase/server";
import { EditListingScreen, type EditListingData } from "@/components/edit-listing-screen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit listing — Alberta-Cars" };

type PageContext = { params: Promise<{ id: string }> };

const OWNER_LISTING_SELECT = "id,user_id,make,model,year,price,mileage,body_type,transmission,fuel,drivetrain,city,color,engine_l,power_hp,description,features,status,created_at,sold_at,listing_images(storage_path,position)" as const;

export default async function EditListingPage(context: PageContext) {
  const { id } = await context.params;
  const listing = await getOwnedListing(id);
  return <EditListingScreen listing={listing} />;
}

async function getOwnedListing(id: string): Promise<EditListingData> {
  const supabase = await createClient<Database>();
  const { data: { user } } = await supabase.auth.getUser();
  const editPath = `/listings/${encodeURIComponent(id)}/edit`;
  // Guests always go to sign-in, including for a missing id, so the response does not reveal the row.
  if (!user) redirect(`/login?next=${encodeURIComponent(editPath)}`);

  const { data, error } = await supabase.from("listings")
    .select(OWNER_LISTING_SELECT)
    .eq("id", id)
    .maybeSingle();
  // Missing and someone else's listing are the same 404. Do not describe which one it was.
  if (error || !data || data.user_id !== user.id) notFound();

  const imageRows = (data.listing_images ?? []).slice().sort((a, b) => a.position - b.position);
  const paths = imageRows.map((image) => image.storage_path).filter((path) => path.length > 0);
  const signed = paths.length
    ? (await supabase.storage.from("listing-photos").createSignedUrls(paths, 3600)).data
    : [];
  const coverUrl = (signed ?? []).map((item) => item.signedUrl).find((url): url is string => typeof url === "string" && url.length > 0) ?? null;

  return {
    id: data.id,
    year: data.year,
    make: data.make,
    model: data.model,
    price: data.price,
    mileage: data.mileage,
    fuel: data.fuel,
    bodyType: data.body_type,
    transmission: data.transmission,
    drivetrain: data.drivetrain,
    city: data.city,
    color: data.color,
    engineL: data.engine_l,
    powerHp: data.power_hp,
    features: Array.isArray(data.features) ? data.features.filter((item): item is string => typeof item === "string") : [],
    description: data.description,
    status: data.status,
    createdAt: data.created_at,
    soldAt: data.sold_at,
    coverUrl,
  };
}
