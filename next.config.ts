import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

/**
 * `withSerwist` marca `esbuild` come pacchetto esterno del server: serve solo al build
 * della rotta che genera il service worker, e non deve finire nel bundle.
 */
const nextConfig: NextConfig = withSerwist({
  // L'app non ha immagini raster (§11.6): l'ottimizzatore non ha niente da fare.
  images: { unoptimized: true },
});

export default nextConfig;
