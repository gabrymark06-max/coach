import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

// Segnaposto onesto: il testo legale definitivo lo scrive il legale. Qui ci sono i fatti veri del prodotto.
export default function Page() {
  return (
    <article className="legal" style={{ padding: "var(--space-8) 0" }}>
      <p className="t-etichetta muted">Bozza · da rivedere con un legale</p>
      <h1 className="t-titolo">Privacy</h1>
      <p className="t-voce">
        Questa pagina è una bozza. Descrive quello che il prodotto fa davvero con i tuoi dati; il testo definitivo, con titolare e riferimenti completi, arriva prima del lancio pubblico.
      </p>
      <h2 className="t-corpo-strong">Cosa raccogliamo</h2>
      <p className="t-voce">Email e password (cifrata). Le risposte dell&apos;onboarding, le sedute che registri, i messaggi che scrivi al coach.</p>
      <h2 className="t-corpo-strong">Dati sulla salute (GDPR, art. 9)</h2>
      <p className="t-voce">
        Infortuni e dolori sono dati sulla salute: li trattiamo solo con un consenso separato, che puoi revocare quando vuoi da Account. Con la revoca vengono cancellati e il piano smette di tenerne conto.
      </p>
      <h2 className="t-corpo-strong">Il coach è un&apos;intelligenza artificiale</h2>
      <p className="t-voce">
        I messaggi che scrivi al coach vengono elaborati da un fornitore di modelli linguistici. Te lo diciamo ogni volta che gli parli. I numeri della scheda non li decide il modello: li decide un motore di regole scritte da persone.
      </p>
      <h2 className="t-corpo-strong">Font e terze parti</h2>
      <p className="t-voce">I caratteri sono serviti dal nostro dominio: nessuna richiesta a Google Fonts. I pagamenti passano da Stripe.</p>
      <h2 className="t-corpo-strong">I tuoi diritti</h2>
      <p className="t-voce">Da Account puoi scaricare tutti i tuoi dati in JSON e cancellare l&apos;account: la cancellazione è definitiva.</p>
    </article>
  );
}
