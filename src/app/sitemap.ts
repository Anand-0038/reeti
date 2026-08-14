import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) return [];

  return [
    {
      url: siteUrl,
      lastModified: new Date("2026-08-14"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
