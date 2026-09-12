import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = ["", "/privacy", "/terms", "/contact"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path ? "monthly" : "daily",
    priority: path ? 0.5 : 1,
  }));

  const supabase = await createClient();
  const { data } = await supabase.from("listings").select("id, updated_at").in("status", ["active", "sold"])
    .order("updated_at", { ascending: false }).limit(5000);
  const listings: MetadataRoute.Sitemap = (data ?? []).map((listing) => ({
    url: `${SITE_URL}/listings/${listing.id}`,
    lastModified: listing.updated_at ? new Date(listing.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  return [...staticPages, ...listings];
}
