import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellForm } from "@/components/sell-form";

// Same "Page — Alberta-Cars" pattern as /contact and listing pages.
export const metadata: Metadata = { title: "Sell your car — Alberta-Cars" };

export default async function SellPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=%2Fsell");

  return <SellForm />;
}
