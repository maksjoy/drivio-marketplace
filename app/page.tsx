import { redirect } from "next/navigation";
import { HomeClient } from "@/components/home-client";

export const revalidate = 0;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HomeContext = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomeContext) {
  const params = await searchParams;
  const listing = typeof params.listing === "string" ? params.listing : "";
  if (UUID.test(listing)) redirect(`/listings/${listing}`);

  // No <Suspense> here: the page is dynamic, so useSearchParams() does not need a boundary, and a
  // boundary made React hold the client-side reveal of the catalog for ~300ms (its fallback throttle)
  // after the RSC payload and JS had arrived. HomeClient renders its own skeleton while loading.
  return <HomeClient />;
}
