"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api/endpoints";

/** Ritorno da Checkout (§3.1): polling di GET /me finché entitlement.plan === "pro", max 60 s. */
export default function SuccessoPage() {
  const { mutate } = useSWRConfig();
  const [state, setState] = useState<"polling" | "pro" | "slow">("polling");
  useEffect(() => {
    let alive = true;
    const start = Date.now();
    const tick = async () => {
      try {
        const me = await api.me.get();
        if (!alive) return;
        if (me.entitlement.plan === "pro") {
          await mutate("/me", me, { revalidate: false });
          await mutate("/plans/current");
          setState("pro");
          return;
        }
      } catch {
        // riprovo al prossimo giro
      }
      if (Date.now() - start > 60_000) {
        setState("slow");
        return;
      }
      window.setTimeout(tick, 3000);
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [mutate]);

  if (state === "pro") {
    return (
      <div className="empty" role="status">
        <h1 className="t-titolo">Sei Pro.</h1>
        <p className="t-voce">Costruisco il blocco 2 sui tuoi numeri.</p>
        <div className="pair">
          <Link href="/settimana?blocco=nuovo" className="btn btn-primary">
            Vai alla settimana
          </Link>
          <Link href="/chat" className="btn btn-secondary">
            Parla col coach
          </Link>
        </div>
      </div>
    );
  }
  if (state === "slow") {
    return (
      <div className="empty" role="status">
        <h1 className="t-titolo">Ci sta mettendo più del solito.</h1>
        <p className="t-voce">Il piano si aggiorna da solo appena Stripe conferma. Puoi tornare a Oggi.</p>
        <Link href="/oggi" className="btn btn-secondary">
          Vai a Oggi
        </Link>
      </div>
    );
  }
  return (
    <div className="empty" aria-busy="true" role="status">
      <h1 className="t-titolo">Sto confermando il pagamento…</h1>
      <p className="t-voce">Pochi secondi: aspetto la conferma di Stripe.</p>
    </div>
  );
}
