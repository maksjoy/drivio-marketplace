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
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
