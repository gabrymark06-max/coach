import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/prezzi", "/privacy", "/termini", "/crediti"], disallow: ["/oggi", "/settimana", "/chat", "/progressi", "/account", "/onboarding", "/blocco", "/accedi", "/registrati", "/serwist"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
