"use client";

import Link from "next/link";
import type { Note, Prices } from "@/lib/api/types";
import { formatEuro } from "@/lib/format";
import { priceOf } from "@/lib/prices";
import { NoteMark } from "@/components/note/NoteMark";
import { Apparatus } from "@/components/note/Apparatus";
import { ProPill } from "@/components/ui/Pill";

function Mark({ notes, id }: { notes: Note[]; id: string }) {
  const n = notes.find((x) => x.rule_id === id);
  return n ? <NoteMark note={n} scope="landing" /> : null;
}

/** Landing (direzione §10, design §4.6/§8): cos'è → la prova → per chi → quanto costa → l'azione, con l'apparato in fondo. */
/** `prices` è null se GET /billing/prices non ha risposto al build/rivalidazione: la riga del prezzo lo dice, senza numeri. */
export function Landing({ notes, prices }: { notes: Note[]; prices: Prices | null }) {
  const month = priceOf(prices, "month");
  const year = priceOf(prices, "year");
  const founders = priceOf(prices, "year_founders");
  return (
    <div className="landing">
      <section className="hero grid-12" aria-labelledby="h1">
        <div className="col-1-6">
          <p className="t-etichetta muted">
            <span>
              fitcoach
              <Mark notes={notes} id="system.about" />
            </span>
            <span className="eyebrow-tail"> — coach di palestra, in italiano</span>
          </p>
          <h1 id="h1" className="t-display" style={{ marginTop: "var(--space-4)" }}>
            Una scheda che dice perché. Un coach che ti scrive il giorno in cui non hai voglia.
          </h1>
          <p className="t-voce measure-voice" style={{ marginTop: "var(--space-4)" }}>
            Per chi va in palestra da solo, da poco o dopo una pausa, e almeno una volta ha smesso senza decidere di smettere.
          </p>
          <p className="t-corpo" style={{ marginTop: "var(--space-4)" }} data-prices={month && year ? "api" : "missing"}>
            {month && year ? (
              <>
                <strong>Il primo blocco di 4 settimane è gratis e completo. Poi</strong> <span className="t-numero-riga">{formatEuro(month.amount_eur)}</span>/mese
                <Mark notes={notes} id="system.vat" />, o <span className="t-numero-riga">{formatEuro(year.amount_eur)}</span>/anno. Disdici quando vuoi.
              </>
            ) : (
              <>
                <strong>Il primo blocco di 4 settimane è gratis e completo.</strong> Poi un piano Pro mensile o annuale, IVA inclusa
                <Mark notes={notes} id="system.vat" />: i prezzi sono nella <Link href="/prezzi">pagina Prezzi</Link>. Disdici quando vuoi.
              </>
            )}
          </p>
          <div style={{ marginTop: "var(--space-6)" }}>
            <Link href="/registrati" className="btn btn-primary">
              Fai la tua scheda
            </Link>
            <p className="t-nota muted" style={{ marginTop: "var(--space-2)" }}>
              due minuti, nessuna carta
            </p>
            <a href="#come-funziona" className="btn btn-tertiary" style={{ marginTop: "var(--space-3)" }}>
              Guarda come funziona
            </a>
          </div>
        </div>
        <div className="col-7-12">
          <SchedaMarco notes={notes} compact />
        </div>
      </section>

      <section aria-labelledby="prova-h" className="grid-12">
        <div className="col-2-11 stack-6">
          <div>
            <h2 id="prova-h" className="t-titolo">
              Questa è la scheda di Marco, 34 anni, tornato in palestra dopo otto mesi.
            </h2>
            <p className="t-corpo muted">Tre giorni a settimana, palestra commerciale, obiettivo: ricominciare e restare.</p>
          </div>
          <SchedaMarco notes={notes} />
          <p className="t-voce measure-voice">
            Ogni numero nella tua scheda ha una nota così. Se non ce l&apos;ha, la nota dice <em>nota nostra, non uno studio</em>.
          </p>
        </div>
      </section>

      <section aria-labelledby="giorno-h" className="grid-12">
        <div className="col-3-10 stack-6">
          <h2 id="giorno-h" className="t-titolo">
            Martedì, ore 21:40. Marco ha saltato.
          </h2>
          <div className="thread" style={{ padding: 0 }}>
            <article className="msg-coach" aria-label="Coach, 21:40">
              <p className="msg-label t-etichetta">Coach · 21:40</p>
              <p className="t-voce">Oggi la seduta non c&apos;è stata. Succede, e conta cosa facciamo domani. Com&apos;è andata la giornata?</p>
            </article>
            <article className="msg-user" aria-label="Marco, 21:41">
              <p className="msg-label t-etichetta">Marco · 21:41</p>
              <p className="t-corpo">un casino al lavoro, sono arrivato a casa alle 21</p>
            </article>
            <article className="msg-coach" aria-label="Coach, 21:42">
              <p className="msg-label t-etichetta">Coach · 21:42</p>
              <p className="t-voce">
                Alle <span className="num">21</span> la panca può aspettare. Tre strade, scegli tu:
              </p>
              <div className="msg-options" aria-hidden="true">
                <span className="btn btn-secondary" style={{ flexDirection: "column", alignItems: "flex-start", padding: "var(--space-3) var(--space-5)" }}>
                  <span className="t-corpo-strong">Corta, domani</span>
                  <span className="t-nota muted">25 minuti, 4 esercizi, stessi carichi.</span>
                </span>
                <span className="btn btn-secondary" style={{ flexDirection: "column", alignItems: "flex-start", padding: "var(--space-3) var(--space-5)" }}>
                  <span className="t-corpo-strong">Sposta</span>
                  <span className="t-nota muted">la seduta di oggi va a giovedì, la settimana resta da 3.</span>
                </span>
                <span className="btn btn-secondary" style={{ flexDirection: "column", alignItems: "flex-start", padding: "var(--space-3) var(--space-5)" }}>
                  <span className="t-corpo-strong">Riposo</span>
                  <span className="t-nota muted">chiudo la settimana a 2 e ricalcolo la prossima.</span>
                </span>
              </div>
              <p className="t-voce" style={{ marginTop: "var(--space-3)" }}>
                Non c&apos;è quella giusta. C&apos;è quella che fai.
              </p>
            </article>
          </div>
          <p className="t-voce measure-voice">
            Il coach conosce la tua scheda, le tue ultime sedute e quante volte sei tornato
            <Mark notes={notes} id="system.consistency" />. Non ti fa la predica, non ti manda un audio motivazionale: ti dà tre strade e ricalcola la settimana su quella che scegli.
          </p>
        </div>
      </section>

      <section id="come-funziona" aria-labelledby="come-h">
        <h2 id="come-h" className="t-titolo" style={{ marginBottom: "var(--space-8)" }}>
          Come funziona, in quattro passi.
        </h2>
        <ol className="steps">
          {[
            ["Rispondi a cinque domande.", "Obiettivo, livello, giorni, attrezzatura, vincoli. Due minuti."],
            ["Ricevi la scheda con le note.", "Il coach la commenta in tre righe: perché questo split, questo volume, questa progressione."],
            ["Segui la seduta dal telefono.", "Numeri già compilati, timer che parte al check, sostituisci un esercizio in due tocchi. Funziona anche senza rete."],
            ["Il coach ti scrive quando serve.", "Prima della seduta ti chiede come stai e adatta il giorno. Se salti, ti scrive lui."],
          ].map(([t, d], i) => (
            <li key={t}>
              <p className="t-numero-riga">{i + 1}</p>
              <p className="t-corpo-strong">{t}</p>
              <p className="t-voce">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="chi-h" className="grid-12">
        <h2 id="chi-h" className="visually-hidden">
          Per chi è, per chi no
        </h2>
        <div className="col-2-11 two-col">
          <div className="stack">
            <h3 className="t-titolo">È per te se</h3>
            <ul className="t-voce">
              <li>vai in palestra da solo, senza PT;</li>
              <li>ci vai da meno di un anno, o ci sei tornato dopo una pausa;</li>
              <li>ti alleni 2–4 volte a settimana;</li>
              <li>vuoi capire perché fai una cosa, senza laurearti.</li>
            </ul>
          </div>
          <div className="stack">
            <h3 className="t-titolo">Non è per te se</h3>
            <ul className="t-voce">
              <li>prepari una gara di powerlifting: Juggernaut fa quello meglio di noi;</li>
              <li>vuoi il metodo Mentzer, FST-7 o l&apos;MRV settimana per settimana: Arvo parla la tua lingua;</li>
              <li>cerchi un piano alimentare: non lo facciamo, e non lo scriviamo &quot;in arrivo&quot;.</li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="prezzo-h" className="grid-12">
        <div className="col-3-10 stack-6">
          <h2 id="prezzo-h" className="t-titolo">
            Un piano gratis per sempre, un piano Pro. Nessuna sorpresa.
          </h2>
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
                        <Mark notes={notes} id="system.vat" /> o <span className="t-numero-riga">{formatEuro(year.amount_eur)}</span>/anno
                      </>
                    ) : (
                      <Link href="/prezzi">prezzi nella pagina Prezzi</Link>
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
                    <td>{p}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <td>
                    <Link href="/registrati" className="btn btn-secondary">
                      Inizia gratis
                    </Link>
                  </td>
                  <td>
                    <Link href="/prezzi" className="btn btn-primary">
                      Passa a Pro
                    </Link>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {founders && founders.available ? (
            <p className="t-corpo">
              <strong>I primi 100 abbonati: {formatEuro(founders.amount_eur)}/anno, per sempre finché non disdici.</strong> <Link href="/prezzi">Vedi quanti ne restano</Link>.
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="cta-h" className="grid-12">
        <div className="col-3-10 stack">
          <h2 id="cta-h" className="t-display">
            Fai la tua scheda.
          </h2>
          <p className="t-voce measure-voice">Due minuti, nessuna carta. Il primo blocco è intero e gratis. A fine blocco decidi tu.</p>
          <div>
            <Link href="/registrati" className="btn btn-primary">
              Fai la tua scheda
            </Link>
          </div>
        </div>
      </section>

      <div className="grid-12">
        <div className="col-3-10">
          <Apparatus notes={notes} scope="landing" />
        </div>
      </div>
    </div>
  );
}

function SchedaMarco({ notes, compact }: { notes: Note[]; compact?: boolean }) {
  const rows: [string, string, string, string, string | null, string | null, string | null][] = [
    ["Squat con bilanciere", "3 × 8", "2′", "2–3 ripetizioni in canna", "volume.weekly_sets.beginner", "rest.compound", "rir.target.beginner"],
    ["Panca piana", "3 × 8", "2′", "2–3 in canna", "volume.weekly_sets.beginner", "rest.compound", "rir.target.beginner"],
    ["Rematore con manubrio", "3 × 10", "90″", "2 in canna", null, null, null],
    ["Lento avanti in piedi", "2 × 10", "90″", "2 in canna", null, null, null],
    ["Plank", "3 × 30″", "60″", "—", null, null, null],
  ];
  return (
    <div className="scroll-x" tabIndex={0}>
      <table className="sheet-table t-corpo" aria-label={compact ? "Estratto della scheda di Marco, Full Body A" : "La scheda di Marco, Full Body A"}>
        <thead>
          <tr className="t-etichetta">
            <th scope="col">Esercizio</th>
            <th scope="col">Serie × rip</th>
            <th scope="col">Recupero</th>
            <th scope="col">Quanto vicino al limite</th>
          </tr>
        </thead>
        <tbody>
          {(compact ? rows.slice(0, 3) : rows).map(([name, sr, rest, rir, n1, n2, n3]) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              <td>
                <span className="t-numero-riga">{sr}</span>
                {n1 ? <Mark notes={notes} id={n1} /> : null}
              </td>
              <td>
                <span className="t-numero-riga">{rest}</span>
                {n2 ? <Mark notes={notes} id={n2} /> : null}
              </td>
              <td>
                {rir}
                {n3 ? <Mark notes={notes} id={n3} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
