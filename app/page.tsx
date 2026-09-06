import { Suspense } from "react";
import { HomeClient } from "@/components/home-client";

export const revalidate = 0;

export default function HomePage() {
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
