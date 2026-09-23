# Lifted — rapporto QA

Data: 2026-09-22 · Autore: `qa-engineer` · Commit auditati: `6d7010b`, `016636e` (non pushati)
Ambiente: Windows 11, Edge via Playwright (`channel: "msedge"`), build di produzione
(`pnpm build && pnpm start`, porta 3000). `agent-browser` è bloccato dalla policy della
macchina: tutto il pilotaggio è Playwright + Edge.

---

## 1. Verdetto

**Pronto con riserve.** Nessun bloccante: l'app si costruisce, si installa, funziona
offline per intero, e tutte e sette le funzionalità della spec esistono e funzionano.
Il backup — l'unica rete di sicurezza di un'app local-first — è la parte migliore del
prodotto e ha retto ogni attacco. Restano **sei difetti gravi**, di cui due fanno dire
al prodotto cose false (il calcolatore di dischi e il riepilogo del profilo) e due
tolgono valore a funzionalità dichiarate nella spec (grafici di andamento, catena
`Invio` in sessione).

---

## 2. Bloccanti

**Nessuno.**

Le cose che avrebbero potuto esserlo, e che ho verificato non lo sono:

| Rischio | Esito |
|---|---|
| Build, typecheck, lint, test | `pnpm build` esce 0 · `tsc --noEmit` pulito · `eslint` pulito · **166/166** unit test · **54/54** e2e |
| Perdita dati su import di un file ostile | 4 file ostili su 4 rifiutati, database **mai toccato** |
| Round trip export → cancella tutto → import | **Identico** byte per byte (verificato leggendo IndexedDB) |
| Record che puntano a sessioni eliminate | I record si rigiocano da zero, i `prIds` delle serie superstiti vengono riscritti |
| Offline | Ricarica, tutte le tab, rotta con id mai visitata, allenamento intero registrato, chiusura e riapertura: **zero errori** |
| Doppio click su `Termina` | Una sola sessione salvata |
| Ricarica dentro una sessione | Atterra su `/allenamento` con la `SessionBar`, come da §6.1 |

---

## 3. Difetti ordinati

### GRAVE 1 — Il calcolatore di dischi propone piastre che non possiedi

L'inventario è **raccolto come totale** e **consumato come per-lato**: un fattore 2 di
troppo su ogni disco.

*Riproduzione*
1. `/impostazioni` → inventario dischi: `20 kg = 2`, tutto il resto `0`.
   (Verificato in IndexedDB: `plateInventory = {"20":2,"15":0,"10":0,"5":0,"2.5":0,"1.25":0}`)
2. Sessione → esercizio con bilanciere → menu ⋮ → `Calcolatore di dischi`, target `100` kg.

*Output reale*
```
Per lato · 40 kg · Totale 100 kg
20  20
2 × 20 kg
```
Nessun avviso: stato `exact`. Chiede **quattro** dischi da 20 kg (2 per lato) quando ne
possiedo **due in tutto**.

*Perché conta* — la copy dell'app promette il contrario, due volte:
- `src/app/impostazioni/impostazioni-view.tsx:207` → «il calcolatore **non propone piastre che non possiedi**»
- `src/app/impostazioni/impostazioni-view.tsx:242` → «Quanti ne hai **in tutto, non per lato**»

*Dove* — `src/lib/logic/plates.ts:170`: `const available = clampCount(inventory[kg]);`
è il tetto **per lato** dentro la DP. Anche `src/lib/logic/plates.ts:86-89`
(`availableUnits`) somma per lato. Il test lo fossilizza: `src/lib/logic/plates.test.ts:51`
(«20 kg per lato con un solo 15 e **due 10**: la risposta è 10+10») chiede 4 dischi da 10
avendone dichiarati 2.

I default aggravano il disallineamento: `20:8` letto per-lato significa 16 dischi da 20 kg,
cioè 340 kg di bilanciere — non è quello che l'utente intendeva scrivendo 8.

*Correzione* — dimezzare all'ingresso, in `toPlateInventory`
(`src/lib/logic/plates.ts:139-145`): `inventory[kg] = Math.floor(clampCount(raw[String(kg)]) / 2)`,
e aggiornare i test perché parlino di totale. In alternativa cambiare le due stringhe in
«per lato», ma è la scelta peggiore: nessuno conta i dischi per lato.

*Ingegnere* — `frontend-engineer` (la logica è sua, in `src/lib/logic/`).

---

### GRAVE 2 — I grafici di andamento sono linee piatte: l'asse Y parte da 0

*Riproduzione* — `/misure` → registra `82,4` kg, poi `81,2` kg → `/misure/bodyweight`.

*Output reale* — asse Y `0 kg / 25 / 50 / 75 / 100`, due punti a 81 e 82: **una riga
orizzontale**. Screenshot: `31-misure-2punti.png`. Una variazione di 1,2 kg — esattamente
quello che l'utente vuole vedere — è invisibile.

Stesso difetto sul 1RM: `/esercizi/[id]` con storico lungo mostra `0 kg / 35 / 70 / 105 / 140`
per valori che vivono fra 66 e 138. Metà grafico è vuoto.

*Dove* — `src/components/charts/recharts-impl.tsx:236-243`: il `<YAxis>` di `TrendChart`
non ha `domain`, quindi Recharts usa `[0, 'auto']`. `TrendChart` è usato in tre punti, e
tutti e tre misurano grandezze che non hanno senso a partire da zero:
- `src/app/(tabs)/misure/[metrica]/metrica-view.tsx:161` — peso e circonferenze
- `src/app/(tabs)/esercizi/[id]/dettaglio-view.tsx:173` — 1RM stimato
- `src/app/(tabs)/statistiche/statistiche-view.tsx:322` — 1RM stimato

*Perché conta* — spec §3.5 («1RM stimato **e suo andamento**») e §3.6 («grafici di
andamento per ciascuna metrica») sono consegnate come rette orizzontali. La funzionalità
c'è e non serve a niente.

*Correzione* — `domain={["dataMin - padding", "dataMax + padding"]}` sul solo `TrendChart`
(padding ≈ 5-10% dell'escursione, minimo un tick). `VolumeBars`
(`src/components/charts/recharts-impl.tsx:319`) deve **restare** a zero: le barre di volume
senza baseline mentirebbero.

*Ingegnere* — `frontend-engineer`.

---

### GRAVE 3 — Il riepilogo del profilo si ferma a 200 allenamenti e non lo dice

*Riproduzione* — importare 220 sessioni, aprire `/profilo`, poi `/statistiche`.

*Output reale*
```
/profilo      → ALLENAMENTI 200 · VOLUME TOTALE 1 890 360 kg · SERIE 3200 · TEMPO IN PALESTRA 12000 min
/statistiche  → "220 allenamenti nell'intervallo scelto"
```
Due schermate della stessa app, due numeri diversi sullo stesso dato.

*Dove* — `src/app/(tabs)/profilo/profilo-view.tsx:19` (`const STORICO_LIMITE = 200`) →
righe 29-32 passano il limite a `listCompletedSessions` → riga 121 dà **lo stesso array
troncato** a `personalTotals`. `/statistiche` invece legge tutto
(`src/app/(tabs)/statistiche/statistiche-view.tsx:61`,
`db.sessions.where("status").equals("completed").toArray()`), da cui la divergenza.

*Perché conta* — spec §3.5 promette «cronologia illimitata». Dopo il 200° allenamento
«VOLUME TOTALE» smette di crescere onestamente e «ALLENAMENTI» si congela, senza alcun
segnale. È un numero sbagliato mostrato con sicurezza.

*Correzione* — separare le due letture: i totali da un'aggregazione su tutte le sessioni
completate (o da un contatore mantenuto), la lista dallo stesso `STORICO_LIMITE` che ha
già. Il «200+ allenamenti» nell'intestazione della lista va bene com'è.

*Ingegnere* — `frontend-engineer`.

---

### GRAVE 4 — La catena `Invio` si spezza su REPS a 375px (l'unico shortcut del sistema)

§8.4: «`Invio` dentro KG → REPS. `Invio` dentro REPS → check. […] **È l'unico shortcut del
sistema ed è quello che vale.**»

*Riproduzione* — 375px, RPE spento (default), sessione con un esercizio: fuoco su KG,
digitare `80`, `Invio`, digitare `10`, `Invio`.

*Output reale* (misurato su tre larghezze)
```
375px   Invio in KG → "Ripetizioni, serie 1, …"   Invio in REPS → "Ripetizioni, serie 1, …"   *** il fuoco non si muove ***
768px   Invio in KG → "Ripetizioni, serie 1, …"   Invio in REPS → "RPE da 1 a 10, serie 1, …"
1440px  Invio in KG → "Ripetizioni, serie 1, …"   Invio in REPS → "RPE da 1 a 10, serie 1, …"
```
Atteso in tutti e tre i casi: `Completa serie 1 …`.

*Causa* — `src/components/session/set-row.tsx:186`: la cella RPE prende
`hidden md:table-cell` quando la colonna è spenta, ma il `<select data-set-focus>` che
contiene resta nel DOM e **non** è `disabled`. `focusNextField`
(`src/components/session/number-field.tsx:202-211`) filtra solo su `disabled`, quindi
sceglie il select come nodo successivo e chiama `.focus()` su un elemento
`display: none` — che non fa nulla, in silenzio. Stato misurato a 375px:
`{"rpeNelDom":true,"rpeDisabled":false,"rpeDisplay":"none"}`.

A 768/1440 il fuoco va sull'RPE anche quando la colonna è **spenta nelle impostazioni**:
§8.4 la mette in catena «solo se attivo».

*Perché conta* — è il caso principale dichiarato dal design (telefono, in palestra) con le
impostazioni di fabbrica. Il tasto `Invio` della tastiera di sistema (`enterKeyHint="next"`,
`src/components/session/number-field.tsx:105`) promette di avanzare e non avanza.

*Correzione* — in `focusNextField` filtrare per visibilità reale, non per `disabled`:
`.filter((n) => !n.hasAttribute("disabled") && n.checkVisibility())`. E saltare l'RPE
quando la colonna è spenta anche se il layout la mostra.

*Ingegnere* — `frontend-engineer`.

---

### GRAVE 5 — `/sessione` e `/sessione/riepilogo/[id]` non hanno `<main>`, né `<h1>`, e lo skip link non skippa

*Riproduzione* — `/sessione` → `Tab` → «Vai al contenuto» → `Invio`.

*Output reale*
```
/allenamento    href=#contenuto bersaglio=true (MAIN)  → dopo Invio: MAIN#contenuto
/statistiche    href=#contenuto bersaglio=true (MAIN)  → dopo Invio: MAIN#contenuto
/impostazioni   href=#contenuto bersaglio=true (MAIN)  → dopo Invio: MAIN#contenuto
/sessione       href=#contenuto bersaglio=false main=false → dopo Invio: BODY, hash vuoto
```
axe conferma con tre regole indipendenti, a 375 **e** a 1440:
```
[moderate] landmark-one-main : Document does not have a main landmark
[moderate] page-has-heading-one: Page must have a level-one heading
[moderate] skip-link         : No skip link target
```

*Causa* — `<main id="contenuto">` esiste solo in `src/components/layout/app-shell.tsx:18`
(guscio delle cinque tab) e in `src/app/impostazioni/layout.tsx:26`. Le rotte
`src/app/sessione/**` stanno fuori da entrambi, ma ereditano lo skip link globale di
`src/app/layout.tsx:43`.

*Perché conta* — §8.9 chiede `<main>` e un solo `<h1>` per pagina; §8.4 elenca lo skip
link come parte del contratto. È la schermata su cui si passa tutto il tempo, ed è l'unica
senza punti di riferimento per uno screen reader. Il danno pratico è contenuto (tre tab in
più per arrivare al contenuto), il danno di contratto no.

*Correzione* — avvolgere il contenuto di `src/app/sessione/sessione-view.tsx` e di
`riepilogo-view.tsx` in `<main id="contenuto" tabIndex={-1}>`, e promuovere a `<h1>` il
titolo di sessione (oggi l'intestazione più alta in `/sessione` è un `<h2>`).

*Ingegnere* — `frontend-engineer`.

---

### GRAVE 6 — LCP oltre budget alla prima visita su telefono

`CLAUDE.md` fissa **LCP < 2,5 s**. Misurato due volte, con due strumenti, sempre sopra.

Lighthouse 13.5.0 (Edge via `CHROME_PATH`), preset mobile — Slow 4G + CPU ×4:

| rotta | Perf | A11y | BP | SEO | FCP | **LCP** | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| `/allenamento` | 89 | 100 | 100 | 60 | 754 ms | **3 763 ms** | 19 ms | 0.006 |
| `/statistiche` | 90 | 100 | 100 | 60 | 756 ms | **3 620 ms** | 15 ms | 0.000 |
| `/sessione` → redirect `/allenamento` | 88 | 100 | 100 | 60 | 755 ms | **3 985 ms** | 25 ms | 0.006 |

Misura indipendente via CDP, **Fast 3G + CPU ×4**, 375px, cache vuota e service worker
bloccato (prima visita vera):

| rotta | FCP | **LCP** | CLS | trasferito |
|---|---|---|---|---|
| `/allenamento` | 1 600 ms | **3 412 ms** | 0.0064 | ~1 043 KB |
| `/statistiche` | 1 568 ms | **3 356 ms** | 0.000 | ~996 KB |
| `/profilo` | 1 584 ms | **3 120 ms** | 0.000 | ~977 KB |

Lighthouse indica: `unused-javascript` ~25 KB, `legacy-javascript` ~13 KB,
`render-blocking-insight` ~130-140 ms.

*Contesto che attenua, ma non cancella* — dalla seconda visita il service worker serve
tutto dalla precache e i numeri crollano (stesso throttling, stessa macchina):

| rotta | FCP | LCP | CLS |
|---|---|---|---|
| `/allenamento` (caldo) | 76 ms | **216 ms** | 0.0064 |
| `/statistiche` (caldo, 220 sessioni) | 88 ms | **360 ms** | 0.000 |
| `/profilo` (caldo, 220 sessioni) | 92 ms | **368 ms** | 0.0002 |
| `/sessione` da `AVVIA` (nav client) | — | pronta in **445 ms** | — |

Per una PWA installata il caso caldo è la normalità, ma il budget si misura sulla prima
apertura e lì è mancato di ~900 ms.

*Cosa NON è un difetto* — il **SEO 60** viene da `robots: { index: false }`
(`src/app/layout.tsx:26`), che è voluto: la spec dice «niente SEO di acquisizione». Va
letto come conforme, non come da correggere.

*Verificato come richiesto* — **Recharts resta fuori dal percorso della sessione**: entrando
in `/sessione` si scaricano `08z7a_m7crkrx.js`, `2oxrt7bi1fhjt.js`, `2x91bg0rwnh3c.js` e
**non** `39jirbicz1ont.js` (403 KB, il chunk che contiene Recharts), che compare solo
aprendo `/statistiche`. CLS ottimo ovunque: **0.000-0.006**, molto sotto 0,1. TBT 15-25 ms
→ INP non è a rischio.

*Ingegnere* — `frontend-engineer`.

---

### MINORE 1 — `aria-hidden-focus` (axe: *serious*) con il menu dell'esercizio aperto

*Riproduzione* — `/sessione` con un esercizio → ⋮ `Azioni per …` → axe.
```
[serious] aria-hidden-focus: ARIA hidden element must not be focusable
          or contain focusable elements — 9 nodi (primo: a)
```
Riproducibile a 375 e a 1440. I fogli (`Sheet`) e i dialog **non** hanno il problema: è
specifico del `DropdownMenu`, che mette `aria-hidden` sul resto della pagina senza toglierlo
dall'ordine di tabulazione. In pratica lo skip link e la nav restano raggiungibili con `Tab`
mentre lo screen reader non li può annunciare.

*Dove* — `src/components/ui/dropdown-menu.tsx` (Radix `DropdownMenu.Content`).
*Correzione* — passare `modal` coerente e/o applicare `inert` al resto, come già fa `Sheet`.
*Ingegnere* — `frontend-engineer`.

---

### MINORE 2 — Accordi grammaticali italiani mai gestiti al singolare

Tre occorrenze, tutte visibili a chi apre l'app la prima settimana:

| Dove | Testo reale | Atteso |
|---|---|---|
| `src/app/(tabs)/profilo/profilo-view.tsx:155-156` | «**Dal oggi**, su **1 settimane**.» | «Da oggi, su 1 settimana.» |
| `/profilo`, intestazione storico | «**1 allenamenti**» | «1 allenamento» |
| dialog `TERMINA` | «**1 serie completate** su 3» | «1 serie completata su 3» |
| annuncio import (`#sr-system`) | «Importati **1 allenamenti** e 0 misurazioni.» | «Importato 1 allenamento…» |

`formatRelativeDay` restituisce «oggi / ieri / 3 giorni fa»: concatenarlo a «Dal» non può
funzionare in nessun caso. Serve una forma separata, o «A partire da».
*Ingegnere* — `frontend-engineer`.

---

### MINORE 3 — «TEMPO IN PALESTRA 12000 min»

`formatMinutes` (`src/lib/logic/timer.ts:88-90`) non passa mai alle ore:
`Math.round(ms / 60_000) + " min"`. Su una durata di sessione va bene, sul totale di vita
del profilo (`src/app/(tabs)/profilo/profilo-view.tsx:127`) produce un numero illeggibile.
*Correzione* — una `formatDuration` che rolla a `200 h` / `8 g 8 h` per i totali.
*Ingegnere* — `frontend-engineer`.

---

### MINORE 4 — Nome accessibile balbettante sui tipi di serie

Dopo aver impostato una serie come riscaldamento, il pulsante dell'indice espone:
```
"Riscaldamento (W), tipo: riscaldamento (w). Cambia tipo o elimina"
```
§8.3 prescrive `"Serie 3, tipo: riscaldamento. Cambia tipo o elimina"`. Lo screen reader
ripete il tipo due volte, la seconda in minuscolo con la sigla fra parentesi. Stesso
effetto sul check: `Completa ${setName.toLowerCase()}`
(`src/components/session/set-row.tsx:218`).

*Nota positiva* — il **glifo** `W`/`D`/`F` è sempre presente nella cella e la numerazione
delle serie allenanti si ricalcola correttamente: togliendo il colore il tipo resta
leggibile, come chiede §8.2. Verificato su tutti e tre i tipi.
*Ingegnere* — `frontend-engineer`.

---

### MINORE 5 — Il pulsante centrale della pill timer è alto 42px, non 48

Misurato in sessione con il timer attivo:
```
"Togli 15 secondi al recupero"                                  48x48  ✓
"Metti in pausa il recupero, 1 minuto e 29 secondi rimanenti"  165x42  ✗
"Aggiungi 15 secondi al recupero"                               48x48  ✓
"Salta il recupero"                                             48x48  ✓
```
§8.7 chiede ≥48×48 **dentro `/sessione`**. Sopra i 24px di WCAG 2.5.8 AA, quindi non è una
violazione WCAG: è una violazione del contratto del design system, sul controllo che si
tocca con le mani sudate. Il test e2e «i bersagli della sessione rispettano i 48px»
(`e2e/responsive-a11y.spec.ts:33`) non copre la pill.
*Ingegnere* — `frontend-engineer`.

---

### MINORE 6 — `heading-order` su tre rotte, `region` su `/impostazioni*`

axe, identico a 375 e a 1440:
```
/misure              [moderate] heading-order — h3 senza h2 che lo preceda
/statistiche         [moderate] heading-order — #titolo-volume
/misure/[metrica]    [moderate] heading-order — #titolo-andamento
/impostazioni        [moderate] region — contenuto fuori dai landmark (.pt-5)
/impostazioni/backup [moderate] region — idem
/impostazioni/info   [moderate] region — idem
```
§8.9 chiede «gerarchia senza salti». Su `/impostazioni*` l'intestazione di pagina sta fuori
dal `<main id="contenuto">` di `src/app/impostazioni/layout.tsx:26`.
*Ingegnere* — `frontend-engineer`.

---

### MINORE 7 — La `Description` dei fogli ripete il titolo

`src/components/ui/sheet.tsx:78-80`: quando non si passa `description`, viene renderizzata
una `DialogPrimitive.Description` `sr-only` con **lo stesso testo del titolo**. Risultato
all'apertura: «I tuoi dati restano su questo telefono — I tuoi dati restano su questo
telefono». Succede su tutti i fogli senza descrizione (avviso iniziale, scelta esercizi,
dischi, riscaldamento).
*Correzione* — `aria-describedby={undefined}` sul `Content` invece della descrizione fantasma.
*Ingegnere* — `frontend-engineer`.

---

### MINORE 8 — Scroll orizzontale sulla riga serie a zoom 200% su telefono

375px a zoom 200% = 188 px CSS: `scrollWidth 234` contro `clientWidth 188`, 46px di
eccedenza sulla tabella delle serie.

**Non è una violazione WCAG**: 1.4.10 chiede il reflow fino a 320 px CSS, e **a 320px
l'app non ha scroll orizzontale** (verificato: `no`). Lo segnalo perché chi ingrandisce sul
telefono è esattamente il pubblico di un'app da palestra, e perché era nel perimetro richiesto.

---

## 4. Numeri

### Lighthouse 13.5.0 — Edge

| rotta | form factor | Perf | A11y | Best Pract. | SEO | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|---|---|---|
| `/allenamento` | mobile | 89 | 100 | 100 | 60* | 754 ms | **3 763 ms** | 19 ms | 0.006 | 1 263 ms |
| `/allenamento` | desktop | **100** | 100 | 100 | 60* | 205 ms | 781 ms | 0 ms | 0.002 | 398 ms |
| `/statistiche` | mobile | 90 | 100 | 100 | 60* | 756 ms | **3 620 ms** | 15 ms | 0.000 | 1 246 ms |
| `/statistiche` | desktop | **100** | 100 | 100 | 60* | 205 ms | 737 ms | 0 ms | 0.000 | 397 ms |
| `/sessione`† | mobile | 88 | 100 | 100 | 60* | 755 ms | **3 985 ms** | 25 ms | 0.006 | 1 524 ms |
| `/sessione`† | desktop | **100** | 100 | 100 | 60* | 203 ms | 774 ms | 0 ms | 0.002 | 543 ms |

\* SEO 60 = `noindex` voluto dalla spec, **non** un difetto.
† `/sessione` reindirizza a `/allenamento` senza sessione attiva: questi numeri sono di
`/allenamento`. Vedi «Non verificato».

### Core Web Vitals misurati a mano (CDP), 375px

Prima visita — **Fast 3G + CPU ×4**, cache vuota, service worker bloccato:

| rotta | FCP | LCP | CLS | trasferito | budget LCP < 2,5 s |
|---|---|---|---|---|---|
| `/allenamento` | 1 600 ms | 3 412 ms | 0.0064 | ~1 043 KB | ✗ |
| `/statistiche` | 1 568 ms | 3 356 ms | 0.000 | ~996 KB | ✗ |
| `/profilo` | 1 584 ms | 3 120 ms | 0.000 | ~977 KB | ✗ |

Visita successiva — stesso throttling, service worker attivo:

| rotta | FCP | LCP | CLS | budget |
|---|---|---|---|---|
| `/allenamento` | 76 ms | 216 ms | 0.0064 | ✓ |
| `/statistiche` | 68 ms | 212 ms | 0.000 | ✓ |
| `/profilo` | 72 ms | 180 ms | 0.000 | ✓ |
| `/statistiche` con 220 sessioni | 88 ms | 360 ms | 0.000 | ✓ |
| `/profilo` con 220 sessioni | 92 ms | 368 ms | 0.0002 | ✓ |
| `/sessione` da `AVVIA` (nav client) | — | pronta in 445 ms | — | ✓ |

CLS e INP non sono mai a rischio: **CLS ≤ 0.0064** ovunque, **TBT 15-25 ms**.

### Carico e storico lungo

| Misura | Valore |
|---|---|
| Import di 220 sessioni (~0,9 MB) | 2,6 s, 149 record ricalcolati |
| `/profilo` con 220 sessioni | 438 ms al primo contenuto, 2 278 nodi DOM |
| `/statistiche` con 220 sessioni | 81 ms al primo contenuto |
| Chunk Recharts | 403 KB, **fuori** dal percorso sessione |

### Suite del progetto

```
pnpm typecheck   → pulito
pnpm lint        → pulito
pnpm test        → Test Files 14 passed (14) · Tests 166 passed (166) · 316 ms
pnpm e2e         → 54 passed (2.2m)   [375 / 768 / 1440, axe incluso]
pnpm build       → exit 0 · 65 voci in precache (1710.02 KiB)
```

---

## 5. Accessibilità

### Verificato a mano

**Ordine di focus in sessione** — percorso con `Tab`, 30 passi, a 375px. Coincide con §8.4
alla lettera, tranne l'intestazione dell'esercizio (§8.4 la voleva focusable, non lo è —
deviazione difendibile). Tutti i bersagli **48×48**, anello di focus `2px rgb(111,180,255)`
= `--ring` su ognuno, nessuna trappola, ciclo che si chiude:

```
 1. a      "Vai al contenuto"                                    163x52
 2. button "Riduci la sessione e torna indietro"                  48x48
 3. button "Altre azioni della sessione"                          48x48
 4. button "TERMINA"                                              98x48
 5. button "Riordina Panca piana con bilanciere"                   48x48
 6. button "Azioni per Panca piana con bilanciere"                 48x48
 7. button "Serie 1, tipo: normale. Cambia tipo o elimina"         48x48
 8. input  "Peso in chili, serie 1, Panca piana con bilanciere"    79x48
 9. input  "Ripetizioni, serie 1, Panca piana con bilanciere"      60x48
10. button "Completa serie 1 di …, nessun valore"                  48x48
…  (serie 2 e 3 identiche)
19. button "Aggiungi serie"                                       333x48
20. button "Aggiungi esercizio"                                   343x56
```

**Riordino da tastiera** — `Riordina …` è un pulsante reale con nome accessibile; il menu ⋮
dell'esercizio offre «Sposta su / Sposta giù», quindi il drag ha l'alternativa che chiede §8.7.

**Calcolatore dischi e riscaldamento da tastiera** — raggiungibili dal menu ⋮
(`src/components/session/exercise-card.tsx:121-124`), non solo dal tocco lungo sul campo KG
(`src/components/session/number-field.tsx:130-133`). Il tocco lungo ha quindi la sua
alternativa; i `+`/`−` del popover hanno `ArrowUp`/`ArrowDown` sul campo. §8.7 rispettato.

**`prefers-reduced-motion`** — misurato contando le animazioni vive con `document.getAnimations()`,
con il timer sotto i 10 secondi per far scattare la pulsazione:

```
no-preference : 2 animazioni, di cui 1 INFINITA  → lifted-pulse, iterations=∞, 900 ms
reduce        : 0 animazioni, 0 infinite
```
L'animazione infinita **sparisce**, non si accorcia — esattamente la riga più difficile di
§8.6. La pill continua a mostrare colore + label «QUASI», quindi l'informazione resta.

**Contrasti — ricalcolati dal vivo sui valori computati**, non copiati dal documento:

| Coppia | Misurato | §2 dice | Esito |
|---|---|---|---|
| `--text-primary` su `--card` | 16.12:1 | 16.12 | ✓ |
| `--text-secondary` su `--card` | 8.31:1 | 8.31 | ✓ |
| `--text-muted` su `--card-elevated` | 4.87:1 | 4.87 | ✓ |
| `--accent-blue` su `--card-elevated` | 5.31:1 | 5.31 | ✓ |
| `--ring` su `--card-elevated` | 7.31:1 | 7.31 | ✓ |
| `--pr` su `--card` | 9.71:1 | 9.71 | ✓ |
| `--danger` su `--card` | 6.04:1 | 6.04 | ✓ |
| `--success` su `--card` | 9.27:1 | 9.27 | ✓ |
| `--chart-1` su `--card` | 5.93:1 | 5.93 | ✓ |
| `--chart-axis` su `--card` | 8.31:1 | 8.31 | ✓ |
| `#FFFFFF` su `--primary` (`#1268EC`) | **4.98:1** | 4.98 | ✓ |
| `#FFFFFF` su `#1D70F5` (quello della spec) | **4.48:1** | 4.48 | ✗ sotto soglia |

Tutti i numeri del design system si riproducono al centesimo. La ricalibratura
`#1D70F5 → #1268EC` è confermata necessaria e **applicata davvero** nel codice
(`src/app/globals.css:18`).

`#007AFF` come testo: una sola occorrenza di `text-[var(--blue-brand)]`
(`src/components/session/exercise-card.tsx:91`) ed è su un'**icona decorativa**
`aria-hidden` da 20px — cioè «tratto», uso consentito da §1.3, 4.87:1 vs background
(soglia non-testo 3:1). La grep di §8.1 dà un falso positivo; nessun glifo testuale blu
nell'app. La combinazione vietata `--text-muted` su `--surface-hover` (4.39:1) **non
compare** in nessun componente.

**Zoom 200%** — vedi MINORE 8. A 320px nessuno scroll orizzontale.

### axe-core, tutte le rotte × 375 e 1440, stati inclusi

Tag: `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`.
**42 violazioni totali**, tutte `moderate` tranne una `serious`, e tutte già elencate
(GRAVE 5, MINORE 1, MINORE 6). Pulite invece:

```
avviso primo avvio (sheet modale)             pulito (32 regole)
/allenamento (220 sessioni)                   pulito (37 regole)
/profilo (220 sessioni)                       pulito (37 regole)
/esercizi (220 sessioni)                      pulito (41 regole)
/allenamento/routine/nuova                    pulito (40 regole)
/esercizi/nuovo                               pulito (39 regole)
/profilo/sessione/[id]                        pulito (44 regole)
/esercizi/[id]                                pulito (42 regole)
/sessione — sheet scelta esercizi             pulito (39 regole)
/sessione — sheet CALCOLATORE DISCHI          pulito (39 regole)
/sessione — sheet RISCALDAMENTO               pulito (41 regole)
/sessione — dialog TERMINA                    pulito (33 regole)
```

Da segnalare in positivo, perché sono le cose che di solito mancano:
- ogni grafico Recharts ha **una `<table>` reale** con tutti i punti come alternativa testuale;
- la tabella delle serie è una `<table>` vera con `<th scope="col">`, non un grid di `<div>`;
- l'SVG del bilanciere è `role="img"` con `aria-label` parlata
  («Per lato: 2 dischi da venti chili.», `src/components/session/plate-visual.tsx:81-83`);
- le quattro regioni `aria-live` esistono e sono persistenti
  (`#sr-session=polite`, `#sr-timer`, `#sr-pr=polite`, `#sr-system=polite`) e il
  `[role="timer"]` ha `aria-live="off"`, come chiede §8.5;
- gli input ostili producono `aria-invalid="true"` **e** un messaggio che dice cosa fare.

Unico scostamento da §8.5: `#sr-timer` è **sempre** `assertive`, mentre la tabella la
vuole `polite` per avvio/±15s/10s e `assertive` solo per «Recupero terminato». Ogni
annuncio del timer interrompe quello in corso. Minore.

---

## 6. Le sette funzionalità della spec — percorse davvero

| § | Funzionalità | Esito |
|---|---|---|
| 3.1 | Routine illimitate, W/D/F, RPE, volume live, timer con suono | **OK**, tranne GRAVE 4 (catena `Invio`). `AVVIA` da routine precompila esercizi e valori: verificato `routineId`/`routineName` in IndexedDB e campi a `80`/`8` |
| 3.2 | Calcolatore di riscaldamento | **OK** — `Bilanciere 20×10 / 50% 42,5 (41,25) ×8 / 70% 57,5 (57,75) ×5 / 87,5% 72,5 (72,19) ×2`, con recuperi e valore teorico accanto all'arrotondato |
| 3.3 | Calcolatore dischi | **Difettoso** — vedi GRAVE 1. La parte «non arrotondare in silenzio» invece è perfetta (sotto) |
| 3.4 | Libreria + esercizi personalizzati | **OK** — 81 esercizi seminati, filtri per muscolo/attrezzo con conteggio, creazione custom con nomi che contengono `«»`, `;`, virgole e virgolette |
| 3.5 | Statistiche, 1RM, PR | **OK** nella logica, **difettoso** nella resa (GRAVE 2) e nei totali del profilo (GRAVE 3) |
| 3.6 | Misure corporee con grafici | **OK** nei dati, **difettoso** nel grafico (GRAVE 2) |
| 3.7 | Export JSON **e** CSV + import | **OK, senza riserve** |

### Il caso «101 kg», come richiesto

Inventario pieno, target 101 kg:
```
Per lato · 40 kg · Totale 100 kg
Con i dischi disponibili il più vicino è 100 kg (-1).
Per difetto 100 kg, per eccesso 102,5 kg.
```
Inventario ridotto ai soli dischi da 20 kg (verificato in IndexedDB:
`{"20":8,"15":0,"10":0,"5":0,"2.5":0,"1.25":0}`), target 101 kg:
```
Con i dischi disponibili il più vicino è 100 kg (-1).
Per difetto 100 kg, per eccesso 140 kg.
```
**Lo dice, non arrotonda in silenzio.** Coperti anche `target < bilanciere` («Il target è
sotto il peso del bilanciere (20 kg). Cambia il bilanciere qui sopra, o alza il target.»)
e `target == bilanciere` («Servono solo i chili del bilanciere.»).

### Record personali, come richiesto

Due sessioni su Panca piana: 80×8, poi 90×8.
```
sessione 1 → 3 nuovi record  (PR 1RM 101,33 kg · PR VOLUME 640 kg · PR REPS 8 reps — "primo record")
sessione 2 → 2 nuovi record  (PR 1RM 114 kg "+12,67 sul record precedente"
                              PR VOLUME 720 kg "+80 sul record precedente")
```
**Il pari merito non genera record**: 8 reps == 8 reps → nessun PR REPS nella seconda
sessione. Annuncio in `#sr-pr`: «Record personale: Panca piana con bilanciere, 1RM stimato
114 kg, 12,67 in più del record precedente.»

Eliminando la sessione **migliore** (dialog: «Volume, serie e PR calcolati da questa
sessione verranno ricalcolati.»):
```
prima:  e1rm=114 prec=101.33 · e1rm=101.33 · volume=720 prec=640 · volume=640 · reps=8
dopo:   e1rm=101.33 prec=- · volume=640 prec=- · reps=8 prec=-
```
I record tornano ai precedenti, e i `prIds` sulla serie superstite vengono **riscritti** con
i nuovi identificativi: la sessione rimasta mostra «primo record» su tutti e tre, nessun
badge orfano. È la parte più difficile del prodotto ed è corretta.

### Backup, come richiesto

| Caso | Esito |
|---|---|
| Export JSON → `Cancella tutti i dati` → import | **Identico** (impronta su sessioni, serie, PR, misure, custom: uguale) |
| `formatVersion: 2` | Rifiutato: «Questo backup viene da una versione più recente di Lifted. **Aggiorna l'app prima di importarlo.**» — 0 scritture |
| Backup senza `personalRecords` | 3 record **ricalcolati**, `prIds` ricollegati |
| File corrotto (JSON valido, sessioni spazzatura) | «Questo backup è danneggiato e non può essere importato. / **«sessions», voce 2: manca l'identificativo.**» — 0 scritture |
| Non-JSON / JSON di un'altra app | «Questo file non è un backup di Lifted.» — 0 scritture |
| Dopo `Cancella tutti i dati` | Libreria di base riseminata (81 esercizi) alla visita successiva, come promette la copy |

**CSV per Excel italiano** — `lifted-allenamenti-2026-09-22.csv`, ispezionato a byte:
```
$ xxd -l 16  →  efbb bf44 6174 613b ...        BOM UTF-8 ✓
$ file       →  UTF-8 (with BOM), CRLF line terminators ✓
Data;Ora;Allenamento;Esercizio;Serie;Tipo;Peso (kg);...     separatore ";" ✓
22/09/2026;22:46;Sessione libera;Panca piana con bilanciere;1;Normale;82,5;8;...
                                                                       ↑ virgola decimale ✓
```
Accenti e caratteri speciali nei nomi custom sopravvivono al round trip.

### Offline reale, come richiesto

Build di produzione, prima visita, poi `context.setOffline(true)`. Service worker
`activated`, cache `serwist-precache-v2` con **65 voci**.

```
ricarica /allenamento         HTTP 200  contenuto pieno
/profilo /esercizi /misure /statistiche /impostazioni /impostazioni/backup   HTTP 200, tutte
rotta con id MAI visitata (/esercizi/lib-affondi-con-manubri)                HTTP 200, dati corretti
tap su tutte e 5 le tab con i <Link>                                          tutte ok
allenamento intero registrato offline  → /sessione/riepilogo/458b0db5…, 3 nuovi record
chiusura della scheda e riapertura a freddo                                   ok, dati intatti
ERRORI TOTALI: []
```
Zero errori di pagina in tutto il percorso. La strategia scocca `_` → `useRouteId` →
precache funziona come descritta, compreso il caso «rotta con id mai visitata prima».
`session-entry` fa il suo lavoro: ricaricando dentro una sessione si atterra su
`/allenamento` con la `SessionBar` («Riprendi sessione · 0:00:05», 56px), non dentro la sessione.

### PWA

`/manifest.webmanifest`, `content-type: application/manifest+json`:
`id`, `name`, `short_name`, `description`, `lang: it`, `start_url: /allenamento`,
`scope: /`, `display: standalone`, `orientation: portrait`,
`background_color` = `theme_color` = `#0B0C0E` (= `--background`, §11.2 rispettato),
`categories`, 2 shortcut. **Quattro icone, tutte HTTP 200**: 192 e 512 `any`, 192 e 512
`maskable`. `<meta name="theme-color" content="#0B0C0E">` presente nel documento.
Manifest valido e installabile.

---

## 7. Non verificato

Onestamente fuori dalla mia portata o dal perimetro di questa sessione:

1. **`/sessione` sotto Lighthouse.** La rotta reindirizza a `/allenamento` senza sessione
   attiva e senza il marcatore di `session-entry`, quindi i tre numeri `/sessione` nella
   tabella Lighthouse sono in realtà di `/allenamento` (lo si vede da `finalDisplayedUrl`).
   Il dato che ho sulla sessione vera è la navigazione client da `AVVIA`: **445 ms** sotto
   Fast 3G + CPU ×4. Per un Lighthouse onesto servirebbe uno script di preparazione
   (`--extra-headers` non basta: il marcatore sta in `sessionStorage`).

2. **Il suono di fine recupero.** `src/lib/audio.ts` sintetizza due note con Web Audio e ha
   un percorso di sblocco corretto (`unlockAudio()` sul gesto che avvia, `isAudioBlocked()`
   → la pill mostra «Audio non attivo»). **Non ho potuto sentirlo**: headless non ha uscita
   audio. Ho verificato che l'impostazione esiste, è attiva di default e che il codice non
   lancia. Va provato a orecchio su un dispositivo.

3. **La vibrazione.** Stesso motivo: `navigator.vibrate` non fa nulla su desktop.

4. **Installazione PWA vera.** Ho validato manifest, icone, service worker e `theme-color`,
   ma «si installa davvero» si dimostra solo su un telefono: prompt di installazione, icona
   maskable ritagliata dal launcher, splash screen, `display: standalone` senza barra del
   browser, safe area su iPhone con notch, e il comportamento di iOS che **cancella
   IndexedDB dopo 7 giorni di non utilizzo per i siti non aggiunti alla schermata Home** —
   che per un'app local-first è il rischio più grande di tutti e non è verificabile da qui.

5. **Screen reader reale.** Ho verificato nomi accessibili, ruoli, regioni live, ordine di
   focus e contrasti in modo programmatico. NVDA/VoiceOver direbbero come *suona*
   l'insieme; il difetto MINORE 4 (nome balbettante) l'ho dedotto dalla stringa, non
   ascoltato.

6. **Tocco lungo e swipe su hardware touch vero.** `onPointerDown` + timer si comporta
   diversamente sotto un dito che sotto un mouse sintetico. Lo swipe-to-delete sulla riga
   serie non l'ho esercitato.

7. **iOS Safari e Android Chrome.** Tutto l'audit è su Edge/Chromium desktop con viewport
   emulate. Il `<select>` nativo dell'RPE (§11.2 avverte che va forzato) e `100dvh`/
   `env(safe-area-inset-bottom)` si comportano diversamente su Safari.

8. **Il comportamento oltre le 200 sessioni sulla *lista* del profilo.** Ho verificato che
   i *totali* sono sbagliati (GRAVE 3); non ho misurato lo scroll della lista con 1 000+
   sessioni, dove §11.6 chiederebbe la virtualizzazione (oggi assente: a 220 sessioni
   `/profilo` monta 2 278 nodi ed è ancora fluido).

9. **Storage pieno.** §5.3 prevede il messaggio «Spazio esaurito. Esporta un backup e
   libera spazio.» Non ho saturato la quota di IndexedDB per farlo scattare.

10. **Test con dati reali di un utente vero.** Tutto lo storico lungo è generato: nomi di
    esercizio dalla libreria, pesi sintetici, nessuna routine complessa con superset ripetuti.

---

## 8. Cosa rifare prima del prossimo giro

Nell'ordine, per danno all'utente:

1. **GRAVE 1** — dimezzare l'inventario dischi in `toPlateInventory`. L'app oggi mente su
   una funzionalità della spec, e lo fa con sicurezza.
2. **GRAVE 3** — scollegare i totali del profilo dal limite della lista. Stesso motivo:
   numeri sbagliati mostrati come giusti.
3. **GRAVE 2** — `domain` sul `TrendChart`. Due funzionalità della spec su sette
   dipendono da quel grafico.
4. **GRAVE 4** — filtrare per visibilità in `focusNextField`. Una riga.
5. **GRAVE 5** — `<main>` e `<h1>` su `/sessione` e sul riepilogo. Chiude tre regole axe.
6. **GRAVE 6** — i ~38 KB fra `unused-javascript` e `legacy-javascript`, più i 130 ms di
   render-blocking. Non porta da soli l'LCP a freddo sotto 2,5 s, ma è quello che
   Lighthouse indica per primo.
7. I minori, che sono per lo più stringhe.

Poi si rimisura: LCP a freddo, axe sulle rotte toccate, e i due casi `101 kg` / inventario
povero.
