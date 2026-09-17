import type { Metadata } from "next";
import Link from "next/link";
import { formatEuro } from "@/lib/format";
import { getPrices, priceOf } from "@/lib/prices";

export const metadata: Metadata = { title: "Termini", alternates: { canonical: "/termini" } };

export default async function Page() {
  // v1.1.3: la clausola sul prezzo legge il listino; senza risposta rimanda alla pagina Prezzi, senza numeri inventati
  const prices = await getPrices();
  const month = priceOf(prices, "month");
  const year = priceOf(prices, "year");
  return (
    <article className="legal" style={{ padding: "var(--space-8) 0" }}>
      <p className="t-etichetta muted">Bozza · da rivedere con un legale</p>
      <h1 className="t-titolo">Termini del servizio</h1>
      <p className="t-voce">Questa pagina è una bozza. Riporta le regole vere del prodotto; il testo definitivo arriva prima del lancio pubblico.</p>
      <h2 className="t-corpo-strong">Non è un servizio medico</h2>
      <p className="t-voce">
        fitcoach non sostituisce il parere di un medico, di un fisioterapista o di un professionista del movimento. Se hai una condizione di salute, parla con il tuo medico prima di iniziare.
      </p>
      <h2 className="t-corpo-strong">Piano Base e piano Pro</h2>
      <p className="t-voce">
        Il primo blocco di 4 settimane è completo e gratis, senza carta. Pro costa {month && year ? <>{formatEuro(month.amount_eur)} al mese o {formatEuro(year.amount_eur)} all&apos;anno</> : <>quanto indicato nella <Link href="/prezzi">pagina Prezzi</Link></>}, IVA inclusa, e si rinnova finché non lo disdici dal tuo account.
      </p>
      <h2 className="t-corpo-strong">Recesso</h2>
      <p className="t-voce">
        Entro 14 giorni dall&apos;acquisto puoi recedere dal contratto con il pulsante &quot;Recedi dal contratto qui&quot; in Account e ricevi il rimborso integrale.
      </p>
      <h2 className="t-corpo-strong">Uso ragionevole della chat</h2>
      <p className="t-voce">Pro include fino a 300 messaggi al mese e 40 al giorno. I messaggi che il coach ti scrive da solo non contano.</p>
    </article>
  );
}
