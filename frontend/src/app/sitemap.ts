import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["/", "/prezzi", "/privacy", "/termini", "/crediti"].map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: "monthly", priority: p === "/" ? 1 : 0.6 }));
}
