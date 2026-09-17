# fitcoach — Rapporto QA

## Terzo passaggio — 2026-09-17 (mirato: N1-N4)

Server riavviati da zero (backend :8000 dopo `alembic upgrade head`, frontend `pnpm build && pnpm start` :3000, build pulita). `pytest -q` **158 passed in 74 s**. Stesso metodo dei passaggi precedenti; script nuovi `qa3-*.js`, `qa3-*.py`, Lighthouse in `scratchpad/lh3/`, axe in `qa3-axe.log`, log backend `qa3-backend.log` (**0** `unhandled_error` per tutta la sessione, gare comprese).

### Verdetto finale

**Pronto con riserve.** N1 e N2 — i due difetti che tenevano fermo il rilascio — sono chiusi e verificati con le sequenze originali e con quelle nuove chieste dal coordinatore; N4 chiuso; N3 chiuso sulla landing ma lo stesso meccanismo è ricomparso su `/prezzi` (CLS 0,028, sotto soglia). Nessuna regressione sul flusso principale, sui font, sull'accessibilità (axe 0/86×2) e sul backend. Le riserve per lo ship sono elencate in fondo: nessuna blocca il lancio, tutte vanno scritte nel piano di monitoraggio.

### N1-N4 → esito → prova

| # | Difetto | Esito | Prova |
|---|---|---|---|
| N1 | Chiusura offline persa: navigazione fallita, coda inviata solo da `/oggi/seduta`, giorno dopo `session_skipped` | **chiuso** | `qa2-g6e.js` ×3: dopo "Chiudi comunque" offline nessuna navigazione (url resta `/oggi/seduta`, 0 `NAVREQ`). `qa2-g6c.js` ×2: 210 ms dopo il tap `data-status="closed-offline"` "Chiusa sul telefono · la mando appena torna la rete"; al ritorno della rete **1** `POST /sync → applied×3, session.status=short`, vista "Seduta chiusa · versione corta" con la riga del coach, coda 0 / bozza 0. `qa2-g6d.js`: rete che torna su `/oggi/chiusa` **e** su `/oggi` → server `short` entro 12 s, coda vuota, `/oggi` "Seduta fatta, versione corta". `qa2-g6f.js`: il giorno dopo `/today` = `rest_day` (era `session_skipped`), server `short`, 3 serie. `fe2-g6g.js` (dell'ingegnere, rieseguito): A/B/C tutti OK — reload offline resta "chiusa in attesa"; API giù con `onLine=true` in background → nessun drain, `visibilitychange` → drain, server chiuso; seduta aperta con 2 serie offline → 1 sola `POST /sync`, seduta resta aperta. `qa3-n1.js`: **(A)** chiusura offline → tab bar → `/chat` → rete torna lì → 1 `POST /sync`, server `short`, tab "Oggi" → "Seduta fatta"; **(C)** rete che torna a metà seduta: stesso documento (`window` marker intatto, 0 navigazioni), timer ancora aperto, input 62 e 63 intatti, serie 1 sul server 62×11, seduta `planned`. |
| N2 | Due `sync` concorrenti → 500 `IntegrityError` | **chiuso** | `qa2-sync-race.py` ×3: `[applied×3, duplicate×3]` (ordine casuale), mai 500. `qa3-race2.py`: PATCH stesso `client_op_id` ×8 → 8×200; **POST set stesso op_id ×8 → 8×201 e una sola serie aggiunta (3→4)**; 8 PATCH con op diversi sulla stessa serie → 8×200; `close` stesso op_id ×4 → 4×200, `status: short`. `sessions.py:84-89` `with_for_update(of=PlannedSession)` su ogni scrittura. |
| N3 | Landing CLS 0,020 allo swap dei numeri in riga | **chiuso sulla landing, spostato su `/prezzi`** (vedi R1) | `qa2-cls.js` / `vitals.js` ×2: `/` CLS **0,000–0,0002** (era 0,020). `/prezzi` **0,028** (era 0,002). Font: `Archivo-riga.woff2` 15 kB, istanza statica 800/110; `qa3-fonts.js` su `/`, `/prezzi`, `/oggi/seduta`, `/chat`, `/onboarding/pronto`: **0** elementi con peso/larghezza fuori istanza, `archivoRiga` sempre 800 senza `font-variation-settings`. |
| N4 | Composer senza `request_id` sul 500 | **chiuso** | `fe2-n4.js`: "Errore dalla nostra parte, non tua. Riprova tra un minuto. Se continua, scrivimi a supporto@fitcoach.example e cita il codice req-n4-test." |

### Regressioni e difetti residui

#### R1 · `/prezzi`: CLS 0,002 → 0,028 sulla riga del prezzo — frontend-engineer — rifinitura (sotto soglia)
- **Prova (`qa3-cls-prezzi.js` ×3, `qa3-cls-prezzi3.js`, 375 Fast 3G):** un solo shift di 0,0281 a ~1,5 s, sorgenti = i tre nodi di testo del `<p class="t-corpo">` del prezzo e l'apice 2. Geometria frame per frame: a 785 ms (primo paint) lo span "59,99 €" è largo **99 px** e "/anno (" va a capo; a 1492 ms lo span diventa **96 px** e la frase risale sulla prima riga; `archivoRiga` vero arriva solo a 1846 ms (shift 0,0002: il `size-adjust` è giusto). Lo shift grande è quindi la faccia **`archivoRiga Fallback`** (local() con `size-adjust`) che si risolve *dopo* il primo paint: il primo layout usa Arial nuda. Sulla landing il punto di a-capo non cambia e lo shift non si vede; su `/prezzi` sì. Lighthouse mobile `/prezzi` dice CLS 0 perché finisce di misurare prima.
- **Dove:** `frontend/src/app/(public)/prezzi/Pricing.tsx:76-77` (span `t-numero-riga` dentro testo che va a capo); `frontend/src/app/fonts.ts:28` (`preload: false` su `archivoRiga`).
- **Correzione:** `preload: true` su `Archivo-riga.woff2` (15 kB: il primo paint usa già la faccia vera) e/o `white-space: nowrap` sui gruppi "59,99 €/anno" e "9,99 €/mese" così l'a-capo non dipende da 3 px. Test: `qa2-cls.js` → `/prezzi` < 0,005.

#### R2 · Doppio tap su "Chiudi comunque" accoda due `close` — frontend-engineer — rifinitura
- **Prova (`qa3-n1.js` B, `qa3-dblclose.js`):** offline, due click nello stesso giro di eventi → coda `patch_set, close, close`; online → `POST /close` ×2 (200 + 409 `session_closed`). **Esito innocuo** in entrambi i casi: il secondo `close` in `sync` è `error/session_closed` e la UI passa comunque a "chiusa" con coda vuota; online la pagina arriva a `/oggi/chiusa` "Fatta." senza errore a schermo. Ma la guardia è di stato React (`page.tsx:45,88` `if (closing) return`), lo stesso schema di G7 prima della correzione.
- **Correzione:** `inFlight = useRef(false)` come in `RegisterForm`/`Pricing`; test: doppio click → 1 sola op `close` in coda / 1 sola `POST /close`.

### Nessuna regressione

- **Flusso principale** (`qa2-flow.js` + `qa2-flow-b.js`, 375): identico al secondo passaggio, 16 passi, console pulita, 0 API fallite non attese; G2/G3/M3/M4/M9/M10/M12/M13 riconfermati di passaggio.
- **axe-core 4.13, 86 stati × {375, 1440}** (`qa3-axe.log`): **0/0**. `fe2-g6g.js`: 0 violazioni anche sui due stati nuovi `closed-offline` e `closed` di `/oggi/seduta`.
- **Header di sicurezza, `Retry-After` in expose-headers, `/billing/prices`**: invariati.
- **Backend:** 0 `unhandled_error` nel log del terzo passaggio nonostante 3 gare `sync`, 28 scritture concorrenti e 4 `close` simultanee.

### Numeri

**Web Vitals — Playwright, 375, Fast 3G, CPU ×4, 2 run (`vitals.js`)**

| Rotta | LCP | CLS | INP max | JS | 2° passaggio |
|---|---|---|---|---|---|
| `/` | 872–908 ms | **0,000** | 32 ms | 156 kB | 900 / 0,020 |
| `/prezzi` | 788–804 ms | **0,028** | 40 ms | 160 kB | 840 / 0,002 |
| `/oggi` | 2304–2308 ms | 0,000 | 16 ms | 165 kB | 2300 |
| `/oggi/seduta` | 2436–2452 ms | 0,005 | 64 ms | 171 kB | 2456–2500 |
| `/chat` | 2408–2432 ms | 0,000 | 16 ms | 167 kB | 2440 |

**Lighthouse 13.4.1 (Edge, `scratchpad/lh3/`)**

| Rotta | Form | Perf | A11y | BP | SEO | LCP | CLS | TBT | FCP |
|---|---|---|---|---|---|---|---|---|---|
| `/` | mobile | 90 | 100 | 100 | 100 | 3,5 s | 0 | 10 ms | 1,7 s |
| `/` | desktop | 100 | 100 | 100 | 100 | 0,7 s | 0,001 | 0 ms | 0,4 s |
| `/prezzi` | mobile | 93 | 100 | 100 | 100 | 3,2 s | 0 | 10 ms | 1,2 s |
| `/prezzi` | desktop | 100 | 100 | 100 | 100 | 0,7 s | 0 | 0 ms | 0,3 s |

(Perf mobile 90/93 contro 92/94 del secondo passaggio: variazione da run a run, stessi insight residui — CSS render-blocking, 13 KiB legacy JS.)

### Riserve dichiarate per lo ship

1. **Stripe reale mai esercitato** (checkout, webhook, portale, rimborso del recesso): verificato solo il 503 onesto senza chiavi e `GET /billing/prices`. Prima del lancio: una transazione di prova in modalità test con webhook firmato, e il recesso a 14 giorni fino al rimborso.
2. **LLM ed email reali** (provider `fake`): time-to-first-token, streaming lungo, filtro di sicurezza con un modello vero, email di verifica/reset non lette.
3. **Offline testato solo in Edge/Chromium headless**: `navigator.onLine`, `visibilitychange`, IndexedDB e il SW vanno provati su iOS Safari e Android Chrome reali (tab in background, app sospesa, tastiera a schermo nei fogli a 375).
4. **`/oggi/seduta` LCP 2,44–2,50 s a freddo diretto a 375 su Fast 3G**: dentro il budget ma senza margine; via `/oggi` è ~450 ms.
5. **R1 e R2** sopra: rifiniture, non bloccanti.
6. **Rate limiting con più worker/repliche** e **`/prezzi` con l'API giù al render server**: coperti dal codice, non eseguiti.
7. **Screen reader reale** (NVDA/VoiceOver): verificati solo DOM, ruoli, `aria-live`, focus e tastiera.

---

## Secondo passaggio — 2026-09-17

Contratto auditato: **v1.1.3** · Backend: `pytest -q` **155 passed in 79 s** · Frontend: `pnpm build` pulito (Next 16.3.5, `/prezzi` dinamica) · Metodo identico al primo passaggio: entrambi i server riavviati da zero, Playwright + Edge (`channel: "msedge"`) a 375/1440, axe-core 4.13 su 86 stati, Web Vitals via `PerformanceObserver` a 375 su Fast 3G + CPU ×4 (3 run), Lighthouse 13.4.1 CLI con `CHROME_PATH` → msedge (JSON in `scratchpad/lh2/`), sonde HTTP dirette. Script nuovi nello scratchpad: `qa2-*.js`, `qa2-*.py`; screenshot in `qa2-shots/`; log `qa2-axe.log`, `qa2-backend.log`, `qa2-build.log`.

### Verdetto

**Non pronto — per un solo difetto nuovo.** Tutti i 25 difetti del primo passaggio sono chiusi e verificati con riproduzione (tabella sotto); nessuna regressione sul flusso principale, sui font ridotti o sull'accessibilità (axe: 0 violazioni di qualunque impatto su 86 stati). Ma il percorso "chiudo la seduta senza rete" — la ragione d'essere della modalità offline in palestra — lascia l'allenamento fermo sul telefono: la chiusura accodata non parte finché l'utente non riapre per caso `/oggi/seduta`, `/oggi` gli ripropone "Inizia", e il giorno dopo il coach apre la conversazione del "giorno no" per una seduta che è stata fatta (N1). È una correzione piccola (drain globale della coda + stato "chiusa" reso sul posto) e con quella il verdetto passa a **pronto con riserve** (Stripe, LLM ed email reali restano non verificati, come prima).

### Difetto → esito → prova

| # | Difetto (primo passaggio) | Esito | Prova |
|---|---|---|---|
| B1 | Chat con punteggiatura → 500 e quota addebitata | **chiuso** | `qa2-backend.py`: 6 testi (`alert(1)?`, `xkcd:42`, `! & <`, `perché ! ( : & <`, `3:1?`) → tutti 200 SSE con risposta del coach; quota 0 → 6 (uno per turno, nessun `failed`). In UI (`qa2-flow-b.js`): "perché 3:1?" → risposta sui riposi, contatore 14 → 13 → 12. |
| B2 | 500 senza CORS → "Senza rete" | **chiuso** | `qa2-boom.py` (stack ASGI reale su :8001 + rotta che solleva): `500 {"code":"internal_error","detail":"Errore dalla nostra parte…"}` con `access-control-allow-origin: http://localhost:3000`, `x-request-id: qa2-b2-777`, header di sicurezza. In UI (`qa2-b2ui.js`, 500 simulato via `route`): chat → "Errore dalla nostra parte, non tua…" + "non inviato · Riprova", 0 occorrenze di "Senza rete"; `/oggi` con `/today` 500 → "Al supporto cita il codice qa2-b2-ui-2". Vero offline → "Senza rete…" come prima. |
| G1 | Seduta chiusa accetta scritture | **chiuso** | `qa2-g1.py`: dopo `close` → PATCH set / POST set / DELETE set / skip / substitute / readiness / short / close → tutti `409 session_closed`; stesso `client_op_id` già applicato → 200 (idempotente); `sync` → 200 con `[error/session_closed, duplicate, error, error]`, `session.status: short`, nulla cambiato sul server. |
| G2 | `/oggi/seduta` dopo la chiusura ancora modificabile | **chiuso** | `qa2-flow.js` [14-15]: `data-status=closed`, "Chiudi seduta" 0, `button.set-check` 0, input abilitati 0, link "Vedi la chiusura" 1, tap sulla riga 2 → nessuna chiamata API. Chiusa da un altro dispositivo mentre qui si logga (`fe-gravi.js`, rieseguito): `sync` → `session_closed` → pagina in sola lettura, coda 0, bozza 0. |
| G3 | Doppio tap sul check annulla la serie | **chiuso** | `qa2-flow.js` [8-10]: `dblclick` → `aria-pressed=true`; secondo tap a 350 ms → `true`; tap a 900 ms → `false` (l'annulla esplicito resta). |
| G4 | "Tengo il server" → input vecchi | **chiuso** | `fe-gravi.js` rieseguito: altro dispositivo 90×9 → `draft_conflict` → Annulla → riga 3 peso "90" rip "9" RIR 1 `aria-pressed=true`. |
| G5 | Ritorno dopo pausa riproposto dopo la scelta | **chiuso** | `qa2-g5.js`: `full` e `short_tomorrow` → `/today` passa a `rest_day` ("La prossima seduta è venerdì 18 settembre: Full Body B"), seconda scelta → 409 `option_already_chosen` (corretto: stesso messaggio), `chosen:true` sul messaggio. Prima della scelta `/today` ripropone lo stesso messaggio (stesso `redirect`). |
| G6 | Prima seduta offline: reload → `/~offline` | **chiuso** | `qa2-g6.js` A/B: cache `pages-oggi` calda a **185 ms** dal primo `goto` (install del SW), 4 chiavi; offline appena il SW controlla la pagina (35 ms), 1 serie loggata, reload → `/oggi/seduta`, 5 esercizi, 1 fatta, peso 80, "SENZA RETE · SALVO SUL TELEFONO"; al ritorno online "BOZZA RIPRESA · SALVATO", 0 API fallite. |
| G7 | Doppio tap "Passa a Pro" → 2 checkout | **chiuso** | `fe-gravi.js` (3 click nello stesso giro di eventi con risposta ritardata 1,2 s) → 1 sola `POST /billing/checkout`; alert = detail del 503. |
| G8 | Sostituisci senza focus trap; Settimana Esc → body | **chiuso** | 375 (`fe-gravi.js`): 9 Tab dentro il foglio Sostituisci, Shift+Tab dentro, Esc → focus su "Sostituisci"; pannello Settimana Tab ciclico, Esc → cella. 1440 (`qa2-g8-1440.js`): pannello non modale (`aside`), focus sul titolo, Tab resta nel pannello, Esc → focus sulla cella "Giovedì 17/09/2026, Full Body A". |
| G9 | Focus sotto la tab bar | **chiuso** | `qa2-g9.js` con timer aperto (tab bar a y 748, timer a y 572): `html { scroll-padding-bottom: 256px }`, 67 Tab → **0** elementi a fuoco sotto il bordo; `fe-gravi.js` 60 Tab → 0/60. |
| M1 | LCP `/oggi/seduta` 3,4 s; CLS `/chat` 0,117 | **chiuso** (LCP al limite) | `vitals.js` ×3: `/oggi/seduta` LCP **2456 / 2472 / 2500 ms** a freddo diretto (via `/oggi` è la cache SWR); `/chat` CLS **0,000**; JS 163–170 kB. |
| M2 | Landing Lighthouse mobile 67 | **chiuso** | Lighthouse mobile `/` **92** (LCP 3,4 s, FCP 1,4 s), `/prezzi` **94** (LCP 3,1 s); desktop 100/100. Residuo: `render-blocking-insight` 700 ms (CSS). |
| M3 | Annuncio fascia quota sovrascritto | **chiuso** | `qa2-m3.js` (polling `#annunci` ogni 60 ms): 12° messaggio → "Ti restano 3 messaggi questo mese." (88 ms) → "Il coach ha risposto" (1564 ms); 15° → "Messaggi del mese finiti." → "Il coach ha risposto" (+1,5 s); composer sparisce, card Pro 1. |
| M4 | Focus perso dopo Enter (desktop) | **chiuso** | `qa2-flow-b.js` 1440: durante e dopo l'invio `activeElement = #composer`, `disabled=false`. |
| M5 | `<section role="timer">` | **chiuso** | `RestTimer.tsx:47` → `<div role="timer">`; axe "/oggi/seduta (timer)" 0 violazioni. |
| M6 | 404 senza `main` | **chiuso** | `app/not-found.tsx` presente; `curl /nonesiste` → 404 con `<main id="contenuto">` e h1 "Questa pagina non c'è."; axe 0. |
| M7 | Settimane ripetute con lo stesso nome | **chiuso** | `qa2-m7.js` (blocco finito con `qa-shift.py 35` → mantenimento): landmark "Settimana che si ripete, dal 10/09/2026" e "…dal 17/09/2026"; axe 375/1440 0; "Vedi Pro" 1, card Pro 0. |
| M8 | `og:image` assente | **chiuso** | `<meta property="og:image" content="http://localhost:3000/opengraph-image"/>` su `/` e `/prezzi`; `/opengraph-image` 200 `image/png`. |
| M9 | Apparato con 11 "Apri" identici | **chiuso** | `/oggi/chiusa`: 1 apice nel testo → 1 voce, pulsante "Apri la nota 1: prima le ripetizioni, poi il carico"; "Apri" nudi 0. |
| M10 | Prezzo hard-coded | **chiuso** | `lib/prices.ts` unica fonte (`GET /billing/prices`, cache 60 s lato server, `null` in errore); nessuna costante in `src` (grep `9,99|9.99|59,99` → solo `schema.d.ts`); `/prezzi` 375 chiama `/billing/prices`, mostra 9,99 / 59,99 / 49,99 (4,17 al mese) e "ne restano 100"; con la chiamata client in 503 o in errore di rete i numeri restano quelli dell'HTML server (dall'API, non inventati). Non eseguito: API giù *al render server* (cache 60 s) — coperto dal codice (`getPrices` → `null` → "prezzo non disponibile"/link Prezzi). |
| M11 | 429 senza `Retry-After`; niente header di sicurezza | **chiuso** | 11° login → `429 rate_limited`, `retry-after: 60`, `access-control-expose-headers: X-Request-Id, ETag, Retry-After`; su ogni risposta `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `permissions-policy: camera=(), microphone=(), geolocation=(), payment=()`. In UI (`qa2-b2ui.js`, 429 con `Retry-After: 37`): "…Riprova tra 37 secondi." |
| M12 | Stripe senza chiavi → 500 | **chiuso** | log di avvio `stripe_disabled`; `POST /billing/checkout` → `503 billing_unavailable` "I pagamenti non sono ancora attivi…" con CORS; `/billing/founders` 200; recesso dall'Account con abbonamento inserito a mano → alert con lo stesso detail (non "Senza rete"). |
| M13 | Nessun disclaimer non medico in chat | **chiuso** | Badge AI: "…Non sostituisce un medico: per dolore, malattie o farmaci, senti il tuo." |
| M14 | Doppio `nav[aria-label="Principale"]` | **chiuso** | 375 e 1440: un solo `nav` nel DOM (`display: flex`). |

### Regressioni e difetti nuovi

#### N1 · Chiusura senza rete: la seduta resta sul telefono e il prodotto la dà per non fatta — frontend-engineer — **bloccante (gravità 1-2: perde il risultato del flusso principale)**
- **Riproduzione (`qa2-g6c.js`, `qa2-g6e.js`, `qa2-g6d.js`, `qa2-g6f.js`, tutti a 375):** in seduta, offline, logga 2-3 serie, "Chiudi seduta" → "Chiudi comunque".
  1. **La pagina non va a `/oggi/chiusa`.** `router.replace("/oggi/chiusa")` → il fetch RSC fallisce offline → Next ripiega su una navigazione intera → il SW serve `/oggi/chiusa` (200) ma un **secondo** ripiego la abortisce (`ERR_ABORTED`) e ricarica `/oggi/seduta` (3/3 in `qa2-g6e.js`; 1 volta su 4 nelle altre serie il ripiego arriva davvero a `/oggi/chiusa`). L'utente si ritrova sulla seduta **aperta**, "Chiudi seduta" attivo, nessun segno che la chiusura sia in coda (`F12-close-offline.png`); la coda IndexedDB contiene `patch_set, patch_set, close`.
  2. **La coda parte solo se è montata `/oggi/seduta`.** Torna la rete mentre l'utente è su `/oggi/chiusa` ("Seduta chiusa. Appena torna la rete la mando al coach.") o su `/oggi`: dopo 12 s il server è ancora `planned` e la coda intatta; `/oggi` propone "Full Body A · Inizia · Versione corta" (`F16-online-oggi-_oggi.png`).
  3. **Il giorno dopo** (`qa-shift.py 1`): `GET /today` → `session_skipped`, il coach apre il messaggio del "giorno no"; la seduta diventa `skipped`. Le op vengono inviate solo se l'utente riapre `/oggi/seduta` (che dice "Oggi non c'è una seduta") grazie all'hint locale della seduta precedente: allora il server torna `short` con 3 serie — ma il coach ha già avviato la conversazione sbagliata e nulla nel prodotto porta l'utente lì.
- **Dove:** `frontend/src/app/(app)/oggi/seduta/page.tsx:103-105` (offline → `router.replace`); `frontend/src/lib/draft/useSessionDraft.ts:253-279` (l'unico listener `online`/`visibilitychange` vive nel hook della seduta); `frontend/src/app/sw.ts` (nessun Background Sync); `frontend/src/lib/draft/store.ts:74-77` (`pendingOps` solo per sessione).
- **Correzione:** (a) offline, niente navigazione: rendere sul posto lo stato "chiusa · la mando appena torna la rete" (stesso ramo di `markClosed`, `closedOffline` locale) e solo online `router.replace`; (b) un drain globale nell'`AppShell` — su `online`, su mount e su `visibilitychange` — che legge **tutta** `op_queue` (`getAll`, raggruppata per `session_id`) e la manda a `/sessions/{id}/sync`, poi `mutate("/today")`; (c) opzionale: `sync` event del SW come rete di sicurezza. Test: chiudi offline → vai a `/oggi` → online → entro pochi secondi `/today` = seduta fatta.

#### N2 · Due `sync` identici in volo → 500 `IntegrityError` — backend-python — gravità 3
- **Riproduzione (`qa2-sync-race.py`):** stesso batch (`patch_set ×2 + close`) inviato da due thread nello stesso istante → `[200 applied×3, 500 internal_error]`; ai tentativi successivi `duplicate` per entrambi. Log: `UniqueViolationError: duplicate key value violates unique constraint "uq_session_op"`. Nel browser succede da solo: il reload di N1 fa partire due `flush` (pagina vecchia + nuova) e la UI mostra "ERRORE DI SINCRONIZZAZIONE · RIPROVO" per 8 s (`qa2-g6c.js` run 3), poi si riprende.
- **Dove:** `backend/app/services/sessions.py:415-422` (`_op_result` + `_record_op`: controllo e inserimento non atomici) e `:694-697` (`sync`).
- **Correzione:** `SELECT … FOR UPDATE` sulla `PlannedSession` all'inizio di ogni scrittura (serializza per seduta, che è anche la semantica di `updated_at`), oppure `async with db.begin_nested()` attorno a ogni op con `except IntegrityError → status:"duplicate"`. Test: due `sync` concorrenti con lo stesso `client_op_id` → 200 + 200 (`applied` / `duplicate`).

#### N3 · Landing: CLS 0,020 (era 0,001) allo swap di Archivo — frontend-engineer — rifinitura
- **Prova (`qa2-cls.js`, 375, Fast 3G):** shift a 1,93 s, sorgenti "59,99 €", "9,99 €", "/anno. Disdici quando vuoi.", apice 5 — la riga del prezzo. Gli `<span class="t-numero-riga">` (wdth 110) dentro `.t-corpo` (`Landing.tsx:42-43`) ricadono su un fallback il cui `size-adjust` è calcolato a wdth 100 (`fonts.ts:11-17`): allo swap la riga si riavvolge. Sotto la soglia (0,1), ma è l'unico shift rimasto sul sito. Correzione: evitare i numeri a larghezza 110 dentro testo che va a capo sopra la piega, o riservare la riga (`min-height`), o `font-size-adjust`.

#### N4 · Il composer della chat non cita il `request_id` sul 500 — frontend-engineer — rifinitura
- `Composer.tsx:61-64` mostra solo `detail`; `ErrorBox.tsx:25` (usato da `/oggi`) cita "Al supporto cita il codice …". Allineare.

### Cosa è stato ripercorso senza regressioni

Registrazione da UI (1 sola POST) → onboarding 1-5 → gate → `/onboarding/pronto` (tabella, 14 apici, 0 card Pro, voce in Newsreader 400 18 px) → `/oggi` → readiness (1 POST) → seduta (3 esercizi, scala palestra, nessuno scroll orizzontale) → chiusura con dialog (1 POST) → `/oggi/chiusa` (link, reload, accesso diretto senza `sessionStorage` → "La seduta è registrata") → `/oggi` "Seduta fatta, versione corta" → chat (badge, B1, fasce quota, 15/15, card Pro) → `/settimana` (anche in mantenimento) → `/progressi` (28 celle `role=img`) → `/account` (export, recesso 503 onesto) → `/prezzi` 375 (9,99 sopra la piega a y 325, tre pulsanti "Passa a Pro, …", fondatori "ne restano 100"). Console pulita ovunque salvo i 4xx/5xx attesi.

**Font ridotti (`qa2-fonts.js` + grep):** pesi Archivo usati 500/600/700/800/900 (`base.css`, `components.css`), larghezze 100/110/125 — tutti dentro l'istanza; Newsreader solo 400; `.t-voce` 18 px con `font-optical-sizing: auto` dentro opsz 16-24; `.t-nota` 14-15 px sull'istanza statica opsz 10. Nel browser: `.t-voce em` → `newsreaderItalic/italic/400` caricato (landing e "Non dice …" nel foglio della nota), `em` nel badge → `newsreaderNotaItalic`, `<strong>` in `.t-corpo` → Archivo 700; nessun elemento che chieda un peso fuori istanza.

### Numeri

**Test:** `pytest -q` 155 passed (79 s) · `pnpm build` pulito.

**Web Vitals — Playwright, 375, Fast 3G, CPU ×4, cache vuota, 3 run (`vitals.js`)**

| Rotta | LCP (min–max) | CLS | INP max | JS | Prima |
|---|---|---|---|---|---|
| `/` | 892–912 ms | 0,020 | 64 ms | 156 kB | 852 / 0,001 |
| `/prezzi` | 832–844 ms | 0,002 | 64 ms | 160 kB | 808 / 0,003 |
| `/oggi` | 2292–2312 ms | 0,000 | 32 ms | 161 kB | 2168 |
| `/oggi/seduta` | **2456–2500 ms** | 0,004 | 88 ms | 170 kB | **3408** |
| `/chat` | 2416–2452 ms | **0,000** | 40 ms | 163 kB | 2368 / **0,117** |

**Lighthouse 13.4.1 (Edge via `CHROME_PATH`, `scratchpad/lh2/`)**

| Rotta | Form | Perf | A11y | BP | SEO | LCP | CLS | TBT | FCP | Prima (perf) |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | mobile | **92** | 100 | 100 | 100 | 3,4 s | 0 | 20 ms | 1,4 s | 67 |
| `/` | desktop | 100 | 100 | 100 | 100 | 0,7 s | 0 | 0 ms | 0,3 s | 97 |
| `/prezzi` | mobile | **94** | 100 | 100 | 100 | 3,1 s | 0 | 10 ms | 1,1 s | 69 |
| `/prezzi` | desktop | 100 | 100 | 100 | 100 | 0,6 s | 0 | 0 ms | 0,3 s | 97 |

Insight residui: `render-blocking-insight` 700 / 420 ms (CSS), `legacy-javascript-insight` 13 KiB.

**axe-core 4.13 — 86 pagine/stati × {375, 1440} (`qa2-axe.log`):** critical/serious **0**, moderate/minor **0** (erano 15).

### Non verificato

- **Stripe, LLM ed email reali**: come nel primo passaggio (provider `fake`, chiavi vuote); verificati il 503 onesto e `GET /billing/prices`.
- **Tastiera virtuale nei fogli a 375** (iOS/Android): Playwright non simula la tastiera a schermo né `visualViewport`; verificati solo focus, trap e Esc.
- **`/prezzi` con l'API giù al render server** (cache 60 s di `getPrices`): letto nel codice, non eseguito.
- **Lighthouse sulle rotte autenticate**: come prima, non aggancia l'Edge di Playwright; coperte dai Web Vitals.
- **Screen reader reale, dispositivo reale, più worker per il rate limiting.**

---

## Primo passaggio — 2026-09-17 (contratto v1.1.1)

Data: 2026-09-17 · Autore: qa-engineer · Contratto auditato: v1.1.1 · Build frontend: Next 16.3.5 (`pnpm build` pulito, 41 pagine) · Backend: FastAPI su Postgres embedded.

Metodo: entrambi i server avviati e percorsi davvero con Playwright + Edge (`channel: "msedge"`, `agent-browser` bloccato dalla policy), a 375/768/1440; axe-core 4.13 su 86 pagine/stati; Lighthouse 13.4.1 (su Edge) e Web Vitals via `PerformanceObserver` a 375 su Fast 3G + CPU ×4; `pytest -q`; sonde HTTP dirette sull'API. Script riusabili nello scratchpad (`qa-*.js`, `qa-shift.py`, `qa-lh.js`), screenshot in `qa-shots/`, log in `qa-axe.log`, `qa-pytest.log`, `qa-lh*.log`.

---

## 1. Verdetto

**Non pronto.** Il prodotto funziona nel flusso felice (registrazione → onboarding → seduta → chiusura → chat → paywall) e l'accessibilità è ottima (axe: 0 critical/serious su 86 stati; contrasti, tastiera, focus, reduced-motion verificati a mano). Ma due difetti del backend rompono la chat a un utente normale e lo fanno pagare in quota, e ogni errore 500 dell'API arriva al browser senza CORS e viene mostrato come "Senza rete". Vanno chiusi prima di far entrare chiunque.

---

## 2. Bloccanti

### B1 · Una domanda con punteggiatura in chat → 500, e la quota viene addebitata — backend-python
- **Riproduzione (API, utente free con piano):** `POST /chat/messages {"text":"perché zzzqqq alert(1)?"}` → `500 {"code":"internal_error"}`. Stessa cosa con `"perché xkcd:42 …"`, `"perché zzzq! zzzz & yyyy"`, `"quanto pesa zzzqqq <10kg?"` (4 casi su 5 provati). Poi `GET /chat/quota` → `used: 5` e `GET /chat/messages` mostra i 5 messaggi utente con `status: "sent"`, senza risposta del coach.
- **Causa:** `backend/app/llm/retrieval.py:43` — `func.to_tsquery("italian", " | ".join(words))` con le parole dell'utente non sanificate: `!`, `:`, `&`, `<`, `(` sono operatori tsquery → `PostgresSyntaxError: syntax error in tsquery` (log `qa-backend.log`, `unhandled_error error_type=DBAPIError path=/chat/messages`). Scatta ogni volta che `plainto_tsquery` (riga 36) non trova nulla e si passa al fallback.
- **Perché conta:** il filtro di sicurezza e la quota sono il cuore del free tier; un utente che scrive "perché 3:1?" perde uno dei 15 messaggi e vede un errore. Il messaggio è salvato `sent` a `backend/app/services/chat.py:225` prima di `run_turn` (`:231`) e non viene marcato `failed` su eccezione generica: contratto §8 ("il turno non conta") violato.
- **Correzione:** usare `websearch_to_tsquery`/`plainto_tsquery` anche nel fallback oppure `func.to_tsquery("italian", " | ".join(quote_literal(w) for w in words))` con le parole ripulite da `[^\w]`; avvolgere `run_turn` in `try/except` che porta `um.status = "failed"` e risponde 502 `llm_failed` (non 500) per qualunque errore del tool loop; test con `"perché ! ( : & <"`.

### B2 · Ogni 500 dell'API esce senza header CORS → il frontend dice "Senza rete" — backend-python
- **Riproduzione:** `fetch("/chat/messages", {headers:{Origin:"http://localhost:3000"}})` sul caso B1 → `500`, `access-control-allow-origin: null`, `x-request-id: null`. Nel browser (`qa-d-account.js`, recesso senza chiavi Stripe): console `blocked by CORS policy`, UI: *"Errore: Senza rete. Quello che vedi è l'ultima versione che ho."* (screenshot `D06/D07`). Stessa cosa per il checkout senza chiavi visto dal client (`ApiError(0)`).
- **Causa:** `backend/app/errors.py:129-135` — `@app.exception_handler(Exception)` gira nel `ServerErrorMiddleware` di Starlette, **fuori** dal `CORSMiddleware` (`backend/app/main.py:80-90`) e dal `RequestLogMiddleware` (per questo manca anche `X-Request-Id`).
- **Perché conta:** ogni bug del server viene raccontato all'utente come un problema del suo telefono; il supporto non ha `request_id`; il client va in modalità offline (coda locale) per errori che offline non sono.
- **Correzione:** un middleware ASGI interno (aggiunto **dopo** CORS, cioè più vicino all'app) che cattura `Exception` e restituisce `error_response(500, …)`, così CORS e log lo vestono; in alternativa copiare gli header CORS nella risposta dell'handler. Test: `assert resp.headers["access-control-allow-origin"]` su una rotta che solleva.

---

## 3. Difetti gravi

### G1 · La seduta chiusa accetta ancora scritture (PATCH/sync/add set → 200/201) — backend-python
- **Riproduzione:** dopo `POST /sessions/{id}/close` (status `short`): `PATCH /sessions/{id}/sets/{set2}` con `status:"done", weight_kg:99` → `200`; `POST /sync` → `applied`; `POST /sets` → `201`. `GET /sessions/{id}` mostra la serie 2 modificata e una serie in più, `status` resta `short` e la progressione già calcolata alla chiusura non viene ricalcolata.
- **Dove:** `backend/app/services/sessions.py:461` (`patch_set`), `:471` (`add_set`), `:496` (`delete_set`), `:681` (`sync`) — nessun controllo su `closed_at`; `session_closed` esiste solo per readiness/short/close (`:310`, `:345`, `:578`).
- **Correzione:** `if s.closed_at: raise Conflict(code="session_closed")` in ogni scrittura (duplicati per `client_op_id` esclusi); in `sync` ogni op → `{status:"error", code:"session_closed"}`.

### G2 · `/oggi/seduta` dopo la chiusura mostra ancora la seduta modificabile con "Chiudi seduta" — frontend-engineer
- **Riproduzione (`qa-b2-closed.js`):** chiudi la seduta → `/oggi/seduta` → righe ancora attive, "SALVATO", "Chiudi seduta"; tap su una riga fatta → torna `todo` (e con G1 il server lo accetta); "Chiudi seduta" → *"Errore: La seduta è già chiusa."* (`B11`, `B12`).
- **Dove:** `frontend/src/app/(app)/oggi/seduta/page.tsx:126-144` — non guarda `s.status`.
- **Correzione:** se `s.status !== "planned"` → schermata di sola lettura con `close_line` e link a `/oggi/chiusa`; niente `dispatch`.

### G3 · Doppio tap sul check della serie la annulla — frontend-engineer
- **Riproduzione (`qa-b-seduta.js`):** `dblclick` su "Serie 2 fatta" → `aria-pressed="false"`, timer aperto e richiuso. In palestra il doppio tap è la norma.
- **Dove:** `frontend/src/components/session/SetRow.tsx:383-390` — il click su una riga `done` fa `onUncheck`.
- **Correzione:** ignorare un secondo click entro ~500 ms dal `done` (ref con timestamp) oppure spostare l'annulla su un'azione esplicita ("Annulla serie") e lasciare il check idempotente.

### G4 · Dopo "Quale tengo? → server" le righe mostrano i numeri vecchi — frontend-engineer
- **Riproduzione (`qa-f2-expiry.js`):** altro dispositivo logga la serie 2 a 90 kg × 9; qui "Chiudi seduta" → 409 `draft_conflict` → "Annulla" (tieni il server) → riga 2: input peso `""`, rip `8`, ma `aria-pressed=true` e "RIR 1" (`F08`).
- **Dove:** `frontend/src/components/session/SetRow.tsx:267-268` — `useState(initialWeight)` inizializzato una volta; il check e il RIR vengono dalle props, gli input no.
- **Correzione:** `useEffect` che risincronizza `weight`/`reps` quando cambia `set.logged` (o `key` della riga con `logged.done_at`).

### G5 · Ritorno dopo pausa: scelta fatta, ma `/oggi` la ripropone e la seconda volta è un errore — backend-python (+ frontend)
- **Riproduzione (`qa-g-states.js`, `G11`):** stato `return_after_break` → "Intera" → chat "Intera, allora. La prossima seduta è venerdì 18…" ✓ → torna a `/oggi`: di nuovo "Bentornato… Corta / Intera / Parliamone"; tap "Corta" → *"Errore: Hai già scelto per questo messaggio."* (409 `option_already_chosen`). Il messaggio ha `full: chosen=true`.
- **Dove:** `backend/app/services/today.py:129-149` — la condizione non guarda se il messaggio ha già un'opzione `chosen`. Frontend: `frontend/src/components/today/EmptyState.tsx:38,70` potrebbe almeno nascondere le opzioni già scelte.
- **Correzione:** se un'opzione è `chosen`, `/today` restituisce `rest_day` ("La prossima seduta è venerdì 18: Full Body B") o `session` se è oggi; il frontend disabilita le opzioni con `chosen`.

### G6 · Prima seduta senza rete: reload → "Senza rete." invece della bozza — frontend-engineer
- **Riproduzione (`qa-f-offline.js`):** primo accesso a `/oggi/seduta` (SW attivo, `clientsClaim`), offline, logga 1 serie, reload → pagina `/~offline`, nessuna riga visibile; la bozza è in IndexedDB ma non si vede finché non torna la rete. Alla **seconda** visita online la pagina è in `pages-oggi` e il reload offline funziona (5 righe, "BOZZA RIPRESA", serie aggiunta offline compresa).
- **Dove:** `frontend/src/app/sw.ts:31-34` — `/oggi/*` solo in `NetworkFirst` runtime; la prima navigazione avviene prima che il SW controlli la pagina, quindi non entra in cache. Design §3.3 chiede il **precache** delle rotte `/oggi/*`.
- **Correzione:** aggiungere `/oggi`, `/oggi/seduta`, `/oggi/readiness`, `/oggi/chiusa` a `precacheEntries` (o `warmStrategyCache` all'`install`).

### G7 · Doppio tap su "Passa a Pro" → due `POST /billing/checkout` — frontend-engineer
- **Riproduzione (`qa-e-prezzi.js`):** due click rapidi → `POST inviate: 2`. Con Stripe vero: due Checkout Session e due eventi `checkout_started`.
- **Dove:** `frontend/src/app/(public)/prezzi/Pricing.tsx:34-35` — la guardia legge lo stato React `busy`, non ancora aggiornato al secondo click. `RegisterForm.tsx:20-35` usa correttamente un `useRef`.
- **Correzione:** `inFlight = useRef(false)` come in `RegisterForm`.

### G8 · Foglio "Sostituisci" (mobile) è `aria-modal` ma non intrappola il focus — frontend-engineer
- **Riproduzione (`qa-i-keyboard.js`, 375 e 1440):** Enter su "Sostituisci" → 8 Tab: `Chiudi → 3 alternative → Come si fa [FUORI] → Nota 2 [FUORI] …`. Il foglio della nota (`NoteSheet.tsx:25-35`) invece intrappola. Il pannello Settimana a 375: Esc → focus su `BODY` (non torna alla cella).
- **Dove:** `frontend/src/components/session/ExerciseBlock.tsx:215-276` (`SubstituteSheet`), `frontend/src/components/week/SessionPanel.tsx:31-37`.
- **Correzione:** riusare il trap di `NoteSheet` e restituire il focus all'elemento che ha aperto (§5.3).

### G9 · Focus nascosto sotto la barra tab in seduta a 375 — frontend-engineer
- **Riproduzione:** Tab fino a "Nota 2" del secondo esercizio o a "Note 1–6": elemento focalizzato a `y 768-812` sotto la tab bar (`y ≥ 748`), 7 casi su 45 Tab (`I03-focus-hidden-21.png`).
- **Dove:** `frontend/src/styles/components.css:761-764` — `scroll-padding-bottom` è su `.session-col`, che non è il contenitore di scroll; `base.css:11` mette su `html` solo `scroll-padding-top`.
- **Correzione:** `html { scroll-padding-bottom: calc(var(--nav-h) + var(--timer-h) + env(safe-area-inset-bottom)) }` quando la tab bar è visibile.

---

## 4. Difetti minori

| # | Cosa | Prova | Dove | Ingegnere |
|---|---|---|---|---|
| M1 | `/oggi/seduta` LCP 3,4 s a freddo a 375 (Fast 3G, CPU×4); `/chat` CLS 0,117 (shift a 4,7 s, sorgente `DIV.thread, BUTTON.nota-apice` = swap di Newsreader) | `vitals.js`: `/oggi/seduta LCP 3408 ms`, `/chat CLS 0.117` | `frontend/src/app/fonts.ts:20` (`preload: false` su Newsreader), `styles/components.css:1135` (`.thread` senza altezza riservata durante lo skeleton) | frontend |
| M2 | Landing: Lighthouse mobile perf 67, LCP 6,2 s, FCP 4,2 s (render-blocking 3,1 s stimati) | `qa-lh.log` | CSS/JS bloccanti del layout pubblico; `render-blocking-insight` | frontend |
| M3 | Annuncio della fascia quota (§5.5) sovrascritto: a 12/15 `#annunci` contiene solo "Il coach ha risposto" | `qa-c-chat.js` | `frontend/src/components/chat/ChatScreen.tsx:56-64` + `:95`; `lib/announce.ts` non accoda | frontend |
| M4 | Dopo l'invio da tastiera (Enter, desktop) il focus finisce su `body`: la textarea viene `disabled` | `qa-i-keyboard.js` 1440 | `frontend/src/components/chat/Composer.tsx:328` (`disabled={sending}`) → usare `readOnly` + `aria-busy` o ripristinare il focus | frontend |
| M5 | `<section role="timer">`: axe `aria-allowed-role` (8 occorrenze) | `qa-axe.log` | `frontend/src/components/session/RestTimer.tsx:454` → `<div role="timer">` | frontend |
| M6 | Pagina 404 di default: nessun `main`, skip link punta a un target inesistente, contenuto fuori dai landmark | axe `/nonesiste` ×2 | manca `frontend/src/app/not-found.tsx` | frontend |
| M7 | `/settimana` in mantenimento: due landmark con lo stesso nome (`section[aria-labelledby="w-5"]`) — le settimane ripetute hanno lo stesso `label_it` | axe 375 | `frontend/src/components/week/WeekScreen.tsx` (aria-labelledby per settimana ripetuta) | frontend |
| M8 | Nessun `og:image` nell'HTML di `/` e `/prezzi` benché `/opengraph-image` risponda 200 | `curl / | grep og:image` → vuoto | `frontend/src/app/layout.tsx:19` (`openGraph` senza `images`) | frontend |
| M9 | `/oggi/chiusa`: apparato con 11 voci e 11 pulsanti "Apri" identici per 1 apice nel testo | `qa-b-seduta.js` | pagina `oggi/chiusa` — filtrare le note referenziate o dare nome accessibile "Apri nota N" | frontend |
| M10 | Prezzo Pro hard-coded nel client (`PRICE_MONTH = 9.99`) mentre il backend ha i prezzi | — | `frontend/src/lib/site.ts:2`, `components/paywall/ProCard.tsx:351` | frontend |
| M11 | 429 senza `Retry-After`; nessun header di sicurezza sull'API (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) | `qa_http.py` | `backend/app/errors.py:125-127`, `backend/app/main.py` | backend |
| M12 | Stripe senza chiavi → `RealStripe` con chiave vuota → `APIConnectionError` (500). Meglio un gateway "disabilitato" che risponde 503 `billing_unavailable` con `detail` onesto | log `unhandled_error error_type=APIConnectionError path=/billing/withdraw` | `backend/app/services/stripe_gateway.py:22-24`, `main.py:47` | backend |
| M13 | Nessun disclaimer non medico persistente in `/chat` (c'è nel gate di onboarding e nel blocco sicurezza; il badge AI dice solo "coach AI, non una persona") | `qa-c-chat.js`: `disclaimer non medico in chat: 0` | `frontend/src/components/chat/AiBadge.tsx` | frontend / prodotto |
| M14 | Doppio `nav[aria-label="Principale"]` nel DOM (rail + tab bar; uno `display:none`) — innocuo per axe, ma due landmark identici se un giorno entrambi visibili | `qa-b-seduta.js` strict-mode | `frontend/src/components/nav/AppShell.tsx` | frontend |

---

## 5. Cosa funziona (verificato davvero)

- **Flusso primario a 375** (`qa-a-*.js`, `qa-b-seduta.js`): landing (prezzo 9,99 € a y=539 e CTA a y=660 < 667, 1 solo `h1`, `lang="it"`, nessuno scroll orizzontale) → `/registrati` (vuoto: alert + focus su `#email`; `<script>` e password corta rifiutati; doppio click = 1 `POST /auth/register`) → onboarding 1-5 (vuoto: "Errore: scegli una risposta." + focus; consenso art. 9 separato con apice e textarea che compare solo se spuntato; input ostile con `<script>` ed emoji accettato come testo) → gate "Ultima cosa, per sicurezza", 7 domande, disclaimer non medico, "Passo 6 di 6"; `q1=sì` → 409 `safety_ack_required` → "Prima di iniziare, senti un medico." + [Ho capito, continuo…] [Esco] → 1 sola POST → `/onboarding/pronto` (tabella 5 righe, 20 apici, commento del coach, badge AI, 0 card Pro) → `/oggi` → readiness (pulsante `aria-disabled` finché mancano risposte; 1 sola POST; "Tolgo Plank · Pressa 45°: RIR 5 invece di 4, 2 serie invece di 3…") → seduta (scala palestra, riga set 319×81, input 28 px, check 56×56, 8 righe `data-changed`, annuncio "Serie 1 fatta. Riposo: 90 secondi." in `#annunci` `polite/atomic`, timer `role=timer` con numero `aria-live=off`, RIR pre-selezionato, +30″, Aggiungi/Togli serie, Sostituisci in 2 tocchi con "Sostituito: era Chest press" e carichi azzerati, Salta esercizio → "Ripristina", riga Note, "Come si fa" 7 passi, zoom testo 200 % senza scroll orizzontale) → "Chiudi seduta" con 4 serie da fare → `<dialog>` con focus su "Annulla", Esc annulla e riporta il focus, 1 sola POST `/close` → `/oggi/chiusa` con `close_line` e apici, reload sicuro → `/oggi` "Seduta fatta, versione corta".
- **Chat** (`qa-c-chat.js`): badge AI sticky `role=note`; domanda "perché" → risposta con 2 apici e apparato per messaggio; "dolore forte al petto" → `kind:safety` con filetto rosso 3 px `--danger`, `role=region "Avviso di sicurezza"`, tre opzioni, **quota non consumata**; "Togli una serie alla pressa" → tabella `plan_change` + Applica/Lascia com'è → "APPLICATA" con 1 sola POST; quota 14 → 3 → 2 con testo "Si azzerano il 1° ottobre"; a 15/15 il composer sparisce e compare la card "15 su 15 messaggi usati." con "Passa a Pro — 9,99 €/mese" e "oppure aspetta il 1° ottobre."; 16° via API → 429 `chat_quota_exceeded`; sicurezza a 15/15 → 200; `UPDATE entitlements plan='pro'` → composer torna, "Messaggi illimitati · uso ragionevole 300 al mese", `daily_limit 40`. Enter a 375 = a capo; `maxLength` 2000.
- **Paywall per rotta a 15/15 e in mantenimento:** 0 `.pro-card` in `/oggi`, `/oggi/readiness`, `/oggi/seduta`, `/onboarding/1`, `/onboarding/pronto`, `/settimana`, `/progressi`; 0 nel blocco sicurezza. Card Pro solo in `/chat` (composer), `/blocco/1/riepilogo` (due secondari pari) e dentro il messaggio del coach in mantenimento (`/prezzi?da=maintenance_request`); `/settimana` in mantenimento ha il solo link passivo "Vedi Pro". `POST /plans/proposals` in mantenimento → 403 `plan_required`.
- **Stati difficili** (`qa-f-offline.js`, `qa-f2/f3`, `qa-g-states.js`): offline in seduta → "SENZA RETE · SALVO SUL TELEFONO", coda IndexedDB `patch_set, add_set, patch_set:local-, skip, restore, skip`, "Aggiungi serie" offline con id `local-…`; Sostituisci offline → errore onesto; al ritorno online la coda si svuota e il server ha 80×4 done, la serie aggiunta 77×6, esercizio 2 saltato. **Due browser**: B logga la serie 2, A chiude → 409 `draft_conflict` → dialogo "Ho trovato una seduta più recente sul server. Quale tengo?" ✓ (vedi G4 per l'esito). **Login scaduto a metà seduta** (token corrotto + refresh revocato): `/me` 401 → `/auth/refresh` 401 → `/accedi?next=/oggi/seduta` → dopo il login la bozza è lì ("BOZZA RIPRESA", 66 kg, 1 fatta). **Fine blocco** (date −35 gg): `/today block_completed`, `/oggi` "Blocco 1, chiuso." con "Costruisci il blocco 2 [Pro]" e "Continua in mantenimento — gratis" (0 card), `/blocco/1/riepilogo` con card superficie 1 → mantenimento → `mesocycle.status: maintenance`, `engine_active: false`. **`return_after_break`** (−22 gg): "Bentornato. Sono passate 3 settimane." → "Corta" → `POST /chat/options/short_tomorrow` (1 sola) → "Fatto. Ho sistemato la settimana…"; "Intera" → `full` → "Intera, allora. La prossima seduta è venerdì 18 settembre: Full Body B". **Readiness severe** → tre opzioni. **Versione corta** dall'anteprima → "Tolgo Plank" → in seduta "Plank — tolto oggi · Versione corta: oggi lo saltiamo" → "Rimettilo" → Plank torna con 3 serie, server `removed_today: false`.
- **Account** (`qa-d-account.js`): export JSON (60 kB, 11 chiavi, contiene i vincoli art. 9); revoca consenso con dialogo → `health_consent.given: false` e testo di conferma `role=status`; con abbonamento attivo (riga inserita a mano) compare **"Recedi dal contratto qui"** come pulsante distruttivo `rgb(179,38,30)` 213×44 con apice e "Possibile fino al 01/10/2026", dialogo "Conferma recesso" con focus su Annulla; "Cancella l'account" → logout, `/accedi`, login successivo 401.
- **Prezzi** a 375/768/1440: 9,99 € sopra la piega (y 325/267/347), "IVA inclusa" ×3, recesso 14 giorni ×4, "disdici quando vuoi", contatore fondatori a parole, tabella con `scroll-x tabindex=0`, `?da=` con context line dal backend; checkout senza chiavi → *"Errore: il pagamento non si è aperto. Riprova, oppure scrivimi a supporto@fitcoach.example."* (onesto, ma vedi B2/G7); pagine successo (polling `aria-busy`) e annullato.
- **Backend** (`qa_http.py`): errori uniformi `{code, detail}` su 401/404/409/422/429 (+`errors[]` sul 422); `/auth/login` 10/min → il 10° tentativo è 429 `rate_limited`; CORS: preflight da origine estranea → 400 senza `ACAO`, da `localhost:3000` → 200 con credenziali; UTF-8 corretto; nessuna password/token nei log; `/openapi.json` = 51 percorsi, 54 operazioni, 112 schemi (identico al contratto), e ogni rotta chiamata da `frontend/src/lib/api/endpoints.ts` esiste; JWT manomesso (firma, payload, `alg:none`) → 401.
- **Legale/prodotto:** badge AI Act in chat e in `/onboarding/pronto`; consenso art. 9 separato e revocabile; "Recedi dal contratto qui" visibile in Account; prezzo above the fold; IVA inclusa; disclaimer non medico nel gate di onboarding.
- **SEO/PWA** (HTTP): `sitemap.xml` con `/`, `/prezzi`, `/privacy`, `/termini`, `/crediti`; `robots.txt` con Disallow sulle rotte app; `noindex, nofollow` su `/chat`, `/oggi`, `/settimana`, `/account`, `/onboarding/*`, `/accedi`, `/password/reset`, `/verifica`; meta title/description/canonical/og:title/twitter su `/` e `/prezzi`; `manifest.webmanifest` (`start_url: /oggi`, icone 192/512/maskable), `/serwist/sw.js` 43 kB con 38 entry precache, `/~offline`, `/opengraph-image`, `/icon`, `/apple-icon` tutti 200; font self-hosted (`preload` di Archivo woff2, nessuna richiesta a Google).

---

## 6. Numeri

### Test
- `pytest -q` (backend): **130 passed in 60.90 s** (`qa-pytest.log`).
- `pnpm build` (frontend): pulito, 41 pagine, 38 entry precache (865 KiB).

### Web Vitals — Playwright, 375, Fast 3G (150 ms, 1,6 Mbps), CPU ×4, cache vuota (`vitals.js`)

| Rotta | LCP | CLS | INP (evento max) | JS trasferito |
|---|---|---|---|---|
| `/` | 852 ms | 0,001 | 40 ms | 158 kB |
| `/prezzi` | 808 ms | 0,003 | 48 ms | 159 kB |
| `/oggi` | 2168 ms | 0,000 | — | 185 kB |
| `/oggi/seduta` | **3408 ms** | 0,004 | — | 187 kB |
| `/chat` | 2368 ms | **0,117** | — | 180 kB |

### Lighthouse 13.4.1 (Edge, `--only-categories` 4)

| Rotta | Form | Perf | A11y | BP | SEO | LCP | CLS | TBT | FCP |
|---|---|---|---|---|---|---|---|---|---|
| `/` | mobile | 67 | 100 | 100 | 100 | 6,2 s | 0 | 0 ms | 4,2 s |
| `/` | desktop | 97 | 100 | 100 | 100 | 1,1 s | 0 | 0 ms | 0,8 s |
| `/prezzi` | mobile | 69 | 100 | 100 | 100 | 6,0 s | 0,002 | 0 ms | 3,9 s |
| `/prezzi` | desktop | 97 | 100 | 100 | 100 | 1,1 s | 0,05 | 0 ms | 0,8 s |
| `/oggi`, `/oggi/seduta`, `/chat` | — | non misurabili con Lighthouse (rotte autenticate: Lighthouse non si aggancia all'Edge di Playwright con l'auth in `localStorage`; vedi Web Vitals sopra) | | | | | | | |

File JSON in `scratchpad/lh/` (`home-mobile.json`, `home-desktop.json`, `prezzi-mobile.json`, `prezzi-desktop.json`). Insight su `/` e `/prezzi` mobile: `render-blocking-insight` (stima 3.120 ms), `legacy-javascript-insight` (13 KiB), `network-dependency-tree-insight`; audit con peso falliti: `first-contentful-paint`, `largest-contentful-paint`. Nota: Lighthouse mobile simula 4G lento (1,6 Mbps, RTT 150 ms) + CPU ×4 come i vitals Playwright, ma **conta anche il tempo di rete del documento e del CSS bloccante**: i due numeri (6,2 s vs 0,85 s) misurano la stessa pagina con e senza TTFB simulato; il collo di bottiglia segnalato è il CSS/JS render-blocking, non il layout.

### axe-core 4.13 — 86 pagine/stati × {375, 1440} (`qa-axe.log`)
- **critical/serious: 0** su tutte (pubbliche, onboarding 1/3/5/sicurezza, pronto, oggi anteprima/senza piano/fatta/return_after_break, readiness + risultato + blocco sicurezza, seduta + timer + nota aperta + sostituisci + riga note + dialog chiudi, chiusa, settimana + pannello + mantenimento, chat + card 15/15 + paywall mantenimento + options/safety, progressi vuoto/con dati/esercizio, account + dialog, riepilogo blocco, annullato, 404).
- moderate/minor: 15 → M5 (×8), M6 (×6 su 404), M7 (×1).

---

## 7. Accessibilità verificata a mano (`qa-i-keyboard.js`)

- **Contrasti dai token** (WCAG 2.x): ink/surface 17,77 · ink/paper 16,12 · muted/surface 6,42 · muted/paper 5,82 · ink/highlight 13,31 · on-ink/ink 17,77 · danger/surface 6,54 · danger/paper 5,93 · muted/rule 4,57 → tutti ≥ 4,5:1 come da §1.1; highlight/surface 1,33 e rule/surface 1,41 usati solo come sfondo/separatore (mai unico indicatore: serie fatta = glifo + `aria-pressed`, oggi = bordo + etichetta, cambiato = etichetta "oggi"). Nessun hex fuori da `tokens.css` (solo `opengraph-image.tsx` e `themeColor`).
- **Tastiera in seduta** (375 e 1440): skip link primo nel DOM e visibile al focus, Enter → `#contenuto`; ordine Chiudi seduta → Come si fa → apici → peso → rip → check (per serie) → Aggiungi → Togli → Sostituisci → Salta → Note → esercizio successivo → tab bar: **conforme a §5.3**. Il check con Enter apre il timer e **non ruba il focus** (resta su "Serie 1 fatta"). Anello di focus `solid 2px --ink` ovunque; sugli apici l'anello è sul glifo interno (`components.css:414-417`). Foglio nota mobile: `role=dialog aria-modal`, focus sul titolo, Tab ciclico dentro, Esc chiude e riporta il focus all'apice; a 1440 `aside complementary` non modale, Esc torna all'apice. `<dialog>` di chiusura: focus iniziale su Annulla, Tab resta dentro, Esc = Annulla e focus torna a "Chiudi seduta". Difetti: G8 (Sostituisci senza trap; pannello Settimana Esc → body), G9 (focus sotto la tab bar).
- **Tastiera in chat:** composer → Invia → tab bar; apice con Enter apre il foglio con focus sul titolo; Enter a 375 = a capo, a 1440 invia. Difetto M4 (focus perso dopo l'invio).
- **Annunci:** `#annunci` `aria-live=polite aria-atomic=true` unico; set fatto → "Serie N fatta. Riposo: X secondi." (uno solo); timer: numero `aria-live=off`, annunci "Dieci secondi"/"Riposo finito" nel codice (`RestTimer.tsx:431,435`); rete: "Senza rete · salvo sul telefono" nella riga di stato; coach: `aria-busy` sul messaggio e "Il coach ha risposto" a fine stream ✓; quota: fascia annunciata ma sovrascritta (M3).
- **Reduced motion:** con `prefers-reduced-motion: reduce` `--dur-1/2 = 0s`, `.btn transition 0s`, nessun elemento con animazione/transizione non nulla.
- **Zoom/viewport:** `viewport-fit=cover`, nessun `maximum-scale`/`user-scalable=no`; input a 16 px sui form pubblici e 28 px in seduta; zoom testo 200 % in seduta senza perdita né scroll orizzontale.
- **Responsive:** nessuno scroll orizzontale a 375/768/1440 su `/`, `/prezzi`, `/onboarding/*`, `/oggi/*`, `/settimana`, `/chat`, `/progressi`, `/account`, legali; tabelle con `scroll-x tabindex=0`; target ≥ 44 px (check 56, pulsanti 44, "Recedi" 44).

---

## 8. Non verificato

- **Lighthouse sulle rotte autenticate** (`/oggi`, `/oggi/seduta`, `/chat`): non ottenuto (Lighthouse non si aggancia all'Edge lanciato da Playwright; senza auth le rotte reindirizzano a `/accedi`). I Web Vitals Playwright coprono tutte e cinque le rotte nelle stesse condizioni di rete/CPU.
- **Stripe reale** (checkout, webhook, portale, rimborso del recesso): nessuna chiave; verificato solo l'errore onesto lato UI e i 409 (`no_subscription`). Il recesso a 14 giorni è stato verificato fino al dialogo di conferma.
- **LLM reale**: solo il provider `fake`; streaming vero e time-to-first-token non misurabili.
- **Email** (verifica, reset password, mancata seduta): provider `fake`, non lette.
- **Screen reader vero** (NVDA/VoiceOver): verificati solo DOM, ruoli e `aria-live`.
- **Dispositivo iOS reale** (zoom su input, `Aggiungi a Home`, vibrazione del timer).
- **`week_skipped`, `session_skipped` → redirect a `/chat`, `no_day`/`second_skip`**: coperti dai test backend (`test_contract_v111.py`), non percorsi in browser.
- **Progressi con storico multi-settimana e grafici SVG**: l'utente di prova aveva una sola seduta chiusa → griglia costanza (28 celle `role=img`, `figcaption`) sì, grafici per esercizio no.
- **Rate limiting con più worker/repliche** (dichiarato in memoria, 1 worker).
