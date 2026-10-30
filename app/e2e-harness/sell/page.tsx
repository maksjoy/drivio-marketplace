import type { Metadata } from "next";
import { SellForm } from "@/components/sell-form";
import { requireE2eHarness } from "@/lib/e2e-harness";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sell form (test harness)", robots: { index: false, follow: false } };

export default function SellFormHarness() {
  requireE2eHarness();
  return <SellForm />;
}
