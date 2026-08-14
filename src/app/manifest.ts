import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reeti",
    short_name: "Reeti",
    description: "Your way of working, remembered.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fa",
    theme_color: "#f4f7fa",
    icons: [{ src: "/mark.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
