"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ProPill } from "@/components/ui/Pill";
import { formatEuro, formatResetDay } from "@/lib/format";
import { usePrices } from "@/lib/hooks/useApi";
import { priceOf } from "@/lib/prices";

export type PaywallSurface = "end_of_block" | "chat_quota" | "maintenance_request";

/** Le rotte dove la card non compare mai (§2.5): garanzia per rotta, non per condizione. */
const FORBIDDEN = ["/oggi", "/onboarding"];

function useAllowed(): boolean {
  const p = usePathname();
  return !FORBIDDEN.some((f) => p === f || p.startsWith(`${f}/`));
}

export function pricingHref(surface: PaywallSurface): string {
  return `/prezzi?da=${surface}`;
}

/** Card Pro (§2.5). Superficie 1: fine blocco; 2: quota 15/15 al posto del composer; 3: dentro le options del coach. */
export function ProCard({ surface, children, titleId, resetsAt, isPro, onProClick }: { surface: PaywallSurface; children?: ReactNode; titleId: string; resetsAt?: string | null; isPro?: boolean; onProClick?: () => void }) {
  const allowed = useAllowed();
  // v1.1.3: il prezzo mensile viene dal listino; senza risposta il pulsante dice solo "Passa a Pro" (niente numeri inventati)
  const { data: prices } = usePrices();
  const month = priceOf(prices, "month");
  if (!allowed) return null;
  if (surface === "chat_quota") {
    return (
      <section className="pro-card" aria-labelledby={titleId}>
        <h2 id={titleId} className="t-titolo">
          15 su 15 messaggi usati.
        </h2>
        <p className="t-voce">
          Il coach continua a scriverti lui — commento al piano, giorno no, fine blocco. Per rispondergli prima del {resetsAt ? formatResetDay(resetsAt) : "prossimo mese"} serve Pro.
        </p>
        <div className="row">
          <Link href={pricingHref("chat_quota")} className="btn btn-secondary" onClick={onProClick}>
            Passa a Pro{month ? ` — ${formatEuro(month.amount_eur)}/mese` : ""}
          </Link>
          <span className="t-nota muted">oppure aspetta il {resetsAt ? formatResetDay(resetsAt) : "prossimo mese"}.</span>
        </div>
      </section>
    );
  }
  if (surface === "end_of_block") {
    return (
      <section className="pro-card" aria-labelledby={titleId}>
        {children}
        <div className="pair">
          {isPro ? (
            <Link href="/settimana?blocco=nuovo" className="btn btn-primary">
              Costruisci il blocco 2
            </Link>
          ) : (
            <>
              <Link href={pricingHref("end_of_block")} className="btn btn-secondary" onClick={onProClick}>
                Costruisci il blocco 2 <ProPill />
              </Link>
              <Link href="/settimana?mantenimento=1" className="btn btn-secondary">
                Continua in mantenimento — gratis
              </Link>
            </>
          )}
        </div>
      </section>
    );
  }
  // maintenance_request: la card è passiva, vive dentro il messaggio del coach; qui solo il contenitore
  return (
    <section className="pro-card" aria-labelledby={titleId}>
      {children}
    </section>
  );
}
