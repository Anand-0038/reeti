import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://reeti.local/",
      lastModified: new Date("2026-08-14"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
