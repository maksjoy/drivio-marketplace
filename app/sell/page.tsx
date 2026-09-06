import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellForm } from "@/components/sell-form";

export default async function SellPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <SellForm />;
}
