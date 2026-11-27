import type { MetadataRoute } from "next";
import { SITE } from "./lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1777F2",
    icons: [
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { src: SITE.logo, sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
  };
}
