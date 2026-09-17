"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useChatTexts, usePrices } from "@/lib/hooks/useApi";
import { useAuth, useHydrated } from "@/lib/auth/useAuth";
import { api } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/client";
import type { CheckoutIn, Note, Prices } from "@/lib/api/types";
import { priceOf } from "@/lib/prices";
import { formatEuro } from "@/lib/format";
import { ErrorBox } from "@/components/ui/ErrorBox";
import { Button } from "@/components/ui/Button";
import { ProPill } from "@/components/ui/Pill";
import { NoteMark } from "@/components/note/NoteMark";
import { Apparatus } from "@/components/note/Apparatus";

type Surface = CheckoutIn["from_surface"];

/** Prezzi (§3.1, business §10): prezzo above the fold, tabella con filetti, checkout, contatore fondatori a parole.
 * I numeri vengono da GET /billing/prices (contratto §9, v1.1.3): `initialPrices` è la risposta presa lato server, così il
 * prezzo è già nell'HTML; il client la rinfresca (contatore fondatori). Tre stati: carico / errore onesto / listino. */
export function Pricing({ notes, da, initialPrices }: { notes: Note[]; da: string | null; initialPrices: Prices | null }) {
  const noteIva = notes.find((n) => n.rule_id === "system.vat");
  const noteRecesso = notes.find((n) => n.rule_id === "system.withdrawal");
  const router = useRouter();
  const surface: Surface = da === "end_of_block" || da === "chat_quota" || da === "maintenance_request" ? da : "pricing";
  const { data: texts } = useChatTexts();
  const { data: prices, error: pricesError, isLoading: pricesLoading, mutate: reloadPrices } = usePrices(initialPrices);
  const month = priceOf(prices, "month");
  const year = priceOf(prices, "year");
  const foundersPrice = priceOf(prices, "year_founders");
  const founders = prices?.founders ?? null;
  const hydrated = useHydrated();
  const { loggedIn } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // QA G7: la guardia sta in un ref, non nello stato React: al secondo tap dello stesso frame `busy` non è ancora aggiornato.
  const inFlight = useRef(false);
  const context = surface !== "pricing" ? texts?.paywall_context_line[surface] : null;

  async function checkout(price: CheckoutIn["price"]) {
    if (inFlight.current) return;
    if (!loggedIn) {
      router.push(`/registrati?next=${encodeURIComponent(`/prezzi?da=${surface}`)}`);
      return;
    }
    inFlight.current = true;
    setBusy(price);
    setError(null);
    try {
      const { url } = await api.billing.checkout({ price, from_surface: surface });
      window.location.assign(url);
      // il ref resta true: la pagina sta per andare su Stripe, un secondo tap non deve aprire un'altra sessione
    } catch (e) {
      if (isApiError(e) && e.code === "founders_sold_out") {
        setError(`I 100 posti fondatori sono finiti.${year ? ` Il piano annuale resta a ${formatEuro(year.amount_eur)}.` : ""}`);
        void reloadPrices();
      }
      // v1.1.2: 503 `billing_unavailable` è un errore normale con un detail onesto (pagamenti non attivi), non "senza rete".
      else if (isApiError(e) && e.status === 503) setError(`Errore: ${e.detail}`);
      else setError(`Errore: il pagamento non si è aperto. Riprova${texts?.support_email ? `, oppure scrivimi a ${texts.support_email}` : ""}.`);
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="landing">
      <section className="hero stack-6" style={{ paddingTop: "var(--space-8)" }}>
        {context ? <p className="t-voce measure-voice">{context}</p> : null}
        <h1 className="t-display">Un piano gratis per sempre, un piano Pro. Nessuna sorpresa.</h1>
        {month && year ? (
          <p className="t-corpo measure-voice" data-prices="api">
            <span className="t-numero-riga">{formatEuro(month.amount_eur)}</span>/mese
            {noteIva ? <NoteMark note={noteIva} scope="prezzi" /> : null} o <span className="t-numero-riga">{formatEuro(year.amount_eur)}</span>/anno ({formatEuro(year.per_month_eur)} al mese). IVA inclusa. Disdici quando vuoi, rimborso entro 14 giorni{noteRecesso ? <NoteMark note={noteRecesso} scope="prezzi" /> : null}.
          </p>
        ) : pricesLoading ? (
          <p className="t-corpo measure-voice" aria-busy="true" data-prices="loading">
            Carico il listino…
          </p>
        ) : (
          <div data-prices="error">
            <ErrorBox error={pricesError} onRetry={() => reloadPrices()} title="Non riesco a caricare i prezzi." supportEmail={texts?.support_email} />
            <p className="t-corpo measure-voice" style={{ marginTop: "var(--space-4)" }}>
              Intanto: il primo blocco è gratis e completo, Pro è mensile o annuale con IVA inclusa, disdici quando vuoi, rimborso entro 14 giorni{noteRecesso ? <NoteMark note={noteRecesso} scope="prezzi" /> : null}.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="tab-h">
        <h2 id="tab-h" className="visually-hidden">
          Confronto tra Base e Pro
        </h2>
        {error ? (
          <p className="form-alert t-corpo" role="alert" style={{ marginBottom: "var(--space-6)" }}>
            {error}
          </p>
        ) : null}
        <div className="scroll-x" tabIndex={0}>
          <table className="price-table t-corpo">
            <caption className="visually-hidden">Confronto tra Base e Pro</caption>
            <thead>
              <tr>
                <th scope="col" className="t-etichetta muted">
                  Cosa
                </th>
                <th scope="col">
                  <span className="t-titolo" style={{ display: "block" }}>
                    Base
                  </span>
                  <span className="t-numero-riga">0 €</span>
                </th>
                <th scope="col">
                  <span className="t-titolo" style={{ display: "block" }}>
                    Pro <ProPill />
                  </span>
                  {month && year ? (
                    <>
                      <span className="t-numero-riga">{formatEuro(month.amount_eur)}</span>/mese
                      {noteIva ? <NoteMark note={noteIva} scope="prezzi-t" /> : null} o <span className="t-numero-riga">{formatEuro(year.amount_eur)}</span>/anno
                    </>
                  ) : (
                    <span className="t-corpo muted">{pricesLoading ? "carico…" : "prezzo non disponibile"}</span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Primo blocco di 4 settimane con le note", "completo", "completo"],
                ["Blocchi successivi costruiti sui tuoi dati", "no — la settimana si ripete uguale", "illimitati"],
                ["Seduta: logging, timer, sostituzioni, bozza senza rete", "per sempre", "per sempre"],
                ["Readiness e versione corta della seduta", "per sempre", "per sempre"],
                ["Messaggi al coach", "15 al mese", "illimitati — uso ragionevole: 300 al mese, 40 al giorno"],
                ["\"Giorno no\" con la settimana ricalcolata", "nel primo blocco", "sempre"],
                ["Progressi e costanza", "ultime 8 settimane", "tutto lo storico"],
                ["Disdetta dal tuo account", "—", "quando vuoi"],
                ["Recesso entro 14 giorni", "—", "rimborso integrale"],
              ].map(([k, b, p]) => (
                <tr key={k}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    {k}
                  </th>
                  <td>{b}</td>
                  <td>
                    {p}
                    {k === "Recesso entro 14 giorni" && noteRecesso ? <NoteMark note={noteRecesso} scope="prezzi-t" /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td>
                  {hydrated && loggedIn ? (
                    <Link href="/oggi" className="btn btn-secondary">
                      Sei già dentro
                    </Link>
                  ) : (
                    <Link href="/registrati" className="btn btn-secondary">
                      Inizia gratis
                    </Link>
                  )}
                </td>
                <td>
                  <div className="stack-2">
                    <Button variant="primary" loading={busy === "month"} loadingText="Apro il pagamento…" softDisabled={!month || (busy !== null && busy !== "month")} onClick={() => month && checkout(month.key)}>
                      Passa a Pro, mensile
                    </Button>
                    <Button variant="secondary" loading={busy === "year"} loadingText="Apro il pagamento…" softDisabled={!year || (busy !== null && busy !== "year")} onClick={() => year && checkout(year.key)}>
                      Passa a Pro, annuale
                    </Button>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {foundersPrice && founders ? (
        <section aria-labelledby="fond-h" className="stack">
          <h2 id="fond-h" className="t-corpo-strong">
            I primi 100 abbonati: {formatEuro(foundersPrice.amount_eur)}/anno, per sempre finché non disdici.
          </h2>
          <p className="t-corpo">
            {founders.available && foundersPrice.available ? (
              <>
                Prezzo fondatori {formatEuro(foundersPrice.amount_eur)}/anno ({formatEuro(foundersPrice.per_month_eur)} al mese): ne restano <span className="num t-corpo-strong tnum">{founders.remaining}</span>.
              </>
            ) : (
              "I posti fondatori sono finiti. Il piano annuale resta disponibile."
            )}
          </p>
          {founders.available && foundersPrice.available ? (
            <Button variant="secondary" loading={busy === "year_founders"} loadingText="Apro il pagamento…" softDisabled={busy !== null && busy !== "year_founders"} onClick={() => checkout(foundersPrice.key)}>
              Passa a Pro, prezzo fondatori
            </Button>
          ) : null}
        </section>
      ) : pricesLoading ? (
        <p className="t-corpo" aria-busy="true">
          Conto i posti fondatori…
        </p>
      ) : null}

      <Apparatus notes={notes} scope="prezzi" />
    </div>
  );
}
