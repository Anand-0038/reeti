import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reeti",
    short_name: "Reeti",
    description: "Your way of working, remembered.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef2f5",
    theme_color: "#eef2f5",
    icons: [{ src: "/mark.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
