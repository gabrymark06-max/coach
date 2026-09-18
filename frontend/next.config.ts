import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { contentSecurityPolicy } from "./src/lib/csp";

// Stessa origine che legge il client (`src/lib/api/client.ts`): l'API è l'unica origine esterna ammessa da connect-src.
const csp = contentSecurityPolicy(process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // Il service worker è generato al build (force-static): il browser deve rivalidarlo a ogni controllo, non
        // tenerlo in cache HTTP (Vercel lo servirebbe con la cache dei file statici).
        source: "/serwist/:path*",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
