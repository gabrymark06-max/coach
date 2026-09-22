import type { Metadata, Viewport } from "next";
import { LiveRegions } from "@/components/layout/live-regions";
import { Providers } from "@/components/layout/providers";
import { archivo, publicSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Lifted",
    template: "%s — Lifted",
  },
  description:
    "Diario di allenamento local-first: routine, sessioni, timer di recupero e calcolatori. I dati restano su questo dispositivo.",
  applicationName: "Lifted",
  /**
   * Le icone puntano ai file di `public/`, non alle rotte metadata di Next
   * (`app/icon.png`): quelle hanno un'impronta nell'indirizzo e non entrano nella
   * precache del service worker, quindi offline darebbero una richiesta fallita.
   */
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  // Uso personale: niente acquisizione, niente indicizzazione (spec, "Conseguenze").
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0B0C0E",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Nessun maximum-scale, nessun user-scalable=no: lo zoom non si blocca (§8.7).
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`dark ${archivo.variable} ${publicSans.variable}`}>
      <body className="antialiased">
        <a href="#contenuto" className="skip-link">
          Vai al contenuto
        </a>
        <Providers>{children}</Providers>
        <LiveRegions />
      </body>
    </html>
  );
}
