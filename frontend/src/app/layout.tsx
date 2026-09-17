import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SerwistProvider } from "@serwist/turbopack/react";
import { fontClassName } from "./fonts";
import { OG_BASE, OG_IMAGE, SITE_URL } from "@/lib/site";
import { ToastProvider } from "@/components/ui/Toast";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "fitcoach",
  title: { default: "fitcoach — una scheda che dice perché", template: "%s · fitcoach" },
  description:
    "Coach di palestra in italiano: una scheda con le note a piè di pagina e un coach AI che ti scrive il giorno in cui non hai voglia. Primo blocco di 4 settimane gratis e completo.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "fitcoach" },
  formatDetection: { telephone: false },
  openGraph: { ...OG_BASE },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
};

export const viewport: Viewport = {
  themeColor: "#F4F4F1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className={fontClassName}>
      <body>
        <a className="skip-link" href="#contenuto">
          Vai al contenuto
        </a>
        {/* QA N1/N2: `reloadOnOnline` (default true) ricaricava la pagina al ritorno della rete: due documenti per qualche
            decina di ms, due invii della stessa coda, e lo stato della seduta buttato via a metà allenamento. La rete che
            torna la gestiscono SWR (revalidateOnReconnect) e il drain della coda nell'AppShell. */}
        <SerwistProvider swUrl="/serwist/sw.js" reloadOnOnline={false}>
          <ToastProvider>{children}</ToastProvider>
        </SerwistProvider>
        <div id="annunci" aria-live="polite" aria-atomic="true" />
      </body>
    </html>
  );
}
