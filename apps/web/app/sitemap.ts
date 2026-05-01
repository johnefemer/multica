import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.multica.ai";
  const legalLastModified = new Date("2026-05-01");

  return [
    {
      url: baseUrl,
      lastModified: new Date("2026-05-01"),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date("2026-04-01"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/changelog`,
      lastModified: new Date("2026-04-01"),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/legal/terms`,
      lastModified: legalLastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/privacy`,
      lastModified: legalLastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/security`,
      lastModified: legalLastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/dpa`,
      lastModified: legalLastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/sub-processors`,
      lastModified: legalLastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
