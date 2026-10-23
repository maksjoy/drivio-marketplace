import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alberta-Cars",
    short_name: "Alberta-Cars",
    description: "Private used cars in Alberta.",
    id: SITE_URL,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#245886",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
