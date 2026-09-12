import { Suspense } from "react";
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

  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-prairie-600">
          Loading marketplace…
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
