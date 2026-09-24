# Lifted — rapporto QA

## Secondo audit — 2026-09-24

Autore: `qa-engineer` · Commit auditati: `bf48358`, `b180982`
Ambiente: Windows 11, **Edge via Playwright** (`channel: "msedge"`), build di produzione
(`pnpm build && pnpm start`, porta 3000). `agent-browser` resta bloccato dalla policy
della macchina: tutto il pilotaggio è Playwright + Edge, più Lighthouse 13.5.0 con
`CHROME_PATH` su Edge e axe-core 4.13.0 iniettato a mano.

---

### 1. Verdetto

**Non pronto.** Un bloccante, e non è un caso di bordo: **chiunque abbia registrato anche
un solo allenamento non riesce più a generare un programma del Trainer.** La funzionalità
di punta della v2 è raggiungibile solo da un database vuoto. Misurato: database vuoto →
«Programma generato»; **una** sessione su **un** esercizio → «Non riesco a generare il
programma su questo dispositivo», e nessun programma scritto. Lo stesso difetto uccide
`Rigenera da qui`, `Riduci a 3 giorni a settimana` e `Cambia le risposte`.

Tutto il resto del secondo giro è, al contrario, in netto miglioramento: **6 gravi su 6 e
8 minori su 8 del primo audit sono chiusi**, axe passa da **42 violazioni a 0** su 42
combinazioni rotta×stato×larghezza, la catena `Invio` funziona su tutte le larghezze, il
backup regge v1 e v2, l'offline copre tutte le rotte nuove, e i tre punti dichiarati
fragili dall'ingegnere (orologio del ciclo, programmi lunghi, due schede in parallelo)
**hanno retto**. Senza il bloccante il verdetto sarebbe «pronto con riserve».

---

### 2. Bloccanti

#### BLOCCANTE 1 — Con uno storico di allenamenti, il Trainer non si genera mai

*Riproduzione* (da zero: Impostazioni → Dati → Cancella tutti i dati)
1. `/allenamento` → `Avvia allenamento` → aggiungi `Panca piana (Bilanciere)` →
   `80` `Invio` `8` `Invio` `Invio` → `TERMINA`.
2. `/trainer` → `Inizia il questionario` → sei risposte (Ipertrofia · nessun muscolo ·
   preset `Palestra completa` · Intermedio · 4 giorni · 60 min) → `Genera il programma`.

*Output reale* — quattro configurazioni a confronto, stessa build, stesso questionario:

```
database vuoto (nessuno storico)                          -> /trainer     "Programma generato."       OK
UNA sessione su Panca piana (Bilanciere)                  -> resta su /trainer/questionario
                                                             "Non riesco a generare il programma su questo dispositivo."
                                                             programma: NESSUNO
UNA sessione su Crunch (Palla medica)  [fuori programma]  -> /trainer     "Programma generato."       OK
220 sessioni importate da backup                          -> resta su /trainer/questionario
                                                             nessun toast, programma: NESSUNO
```

La terza riga isola la causa: si rompe **solo** quando lo storico tocca un esercizio che
il generatore mette in settimana 1.

*Causa* — `src/lib/db/trainer-ops.ts:213` chiama `decideProgression` sempre con
`performances: []`, quindi `last === undefined`. In `decideProgression` la guardia di
`src/lib/trainer/rules.ts:175` (`if (input.weekSkipped || performances.length === 0)`)
ritorna **solo** se `base == null` (riga 176) o se la settimana è saltata (riga 189). Ma
`base = workingWeight(last) ?? planned.suggestedWeightKg` (`rules.ts:151`), e
`suggestedWeightKg` è valorizzato **esattamente quando l'utente ha storico** per quel
movimento. Con `base != null` e `weekSkipped` falso la funzione cade oltre la guardia e
arriva a `src/lib/trainer/rules.ts:268`:

```ts
const atTop = allAtTop(last, planned);   // last è undefined
```

→ `allAtTop` dereferenzia `performance.sets` (`rules.ts:356`).

Stack reale, ottenuto rigiocando in `vitest` il dump di IndexedDB prodotto dal browser:

```
TypeError: Cannot read properties of undefined (reading 'sets')
    at allAtTop           (src/lib/trainer/rules.ts:356:19)
    at decideProgression  (src/lib/trainer/rules.ts:268:17)
    at firstWeekDecisions (src/lib/db/trainer-ops.ts:206:20)
    at createProgramFromDraft (src/lib/db/trainer-ops.ts:132:21)
```

*Quanto è largo il danno* — `createProgramFromDraft` è l'unica porta d'ingresso a un
programma nuovo, quindi cadono insieme:

| Percorso | Chi lo chiama | Esito misurato |
|---|---|---|
| `/trainer/questionario` → `Genera il programma` | questionario | «Non riesco a generare il programma su questo dispositivo.» |
| `Cambia le risposte` (colonna destra, ogni dashboard) | stessa rotta | idem |
| banner settimana saltata → `Rigenera da qui` | `regenerateFromToday` (`trainer-ops.ts:665`) | «Non riesco a scrivere su questo dispositivo.» |
| banner due settimane saltate → `Riduci a 3 giorni a settimana` | `reduceDays` (`trainer-ops.ts:654`) | «Non riesco a scrivere su questo dispositivo.» |
| stato «finito» → `Genera il ciclo successivo` (§4.24) | stessa funzione | **non provato** (servono 8 settimane reali), ma è lo stesso percorso |

*Perché conta* — il Trainer è un'aggiunta a un tracker che l'utente usa già: la
popolazione che ha «zero allenamenti registrati» e quella che può usare il Trainer sono
la stessa, e non è quella reale. In più il messaggio **incolpa il dispositivo** («su
questo dispositivo») per un `TypeError` dell'app: l'utente conclude che il suo telefono è
rotto e non riprova.

*Aggravante* — `src/app/(tabs)/trainer/trainer-view.tsx:128` è un `catch {}` vuoto:
l'errore non viene loggato da nessuna parte. Senza il dump di IndexedDB rigiocato fuori
dal browser non sarebbe stato diagnosticabile.

*Correzione verificata* — la guardia deve ritornare **sempre** quando non c'è una
prestazione da leggere. Patch minima su `src/lib/trainer/rules.ts:189`:

```diff
-    if (input.weekSkipped) {
+    if (input.weekSkipped || last == null) {
       return {
         rule: "skip-hold",
```

Applicata e provata: il repro passa e **317/317** test verdi (315 esistenti + 2 di
regressione). Poi rimossa: il repo è stato riportato al commit auditato, verificato con
`diff` e con `pnpm test` → 315/315. *Non* basta intervenire sul punto di crash
(`const atTop = last != null && allAtTop(...)`): tutta la coda di `decideProgression`
da riga 268 in poi (`averageRpe` a `rules.ts:361`, `peak`, `describeSets`) assume `last`
definito, e la patch puntuale sposta solo il `TypeError` di tre righe — verificato.

*Ingegnere* — `frontend-engineer` (proprietario di `src/lib/trainer/` e `src/lib/db/`).

---

### 3. I difetti del primo audit — esito uno per uno

Riverificati con le **sequenze originali** del rapporto del 2026-09-22.

| # | Difetto del primo audit | Esito | Prova |
|---|---|---|---|
| **GRAVE 1** | Il calcolatore di dischi propone piastre che non possiedi | **CHIUSO** | Inventario `20 kg = 2`, resto `0` (IndexedDB: `{"20":2,...}`), target `100` → «Per lato · 20 kg · Totale 60 kg / 1 × 20 kg / Con i dischi disponibili il più vicino è 60 kg (-40)». Il diviso due sta in `src/lib/logic/plates.ts:160` |
| **GRAVE 2** | I grafici di andamento sono linee piatte (asse Y da 0) | **CHIUSO** | `/misure/bodyweight` con 82,4 e 81,2 kg → asse `80,5 / 81 / 81,5 / 82 / 82,5 / 83` + la riga obbligatoria «**Scala: 80,5 – 83 kg**» (§4.10-bis). Logica in `src/lib/logic/chart-domain.ts` |
| **GRAVE 3** | Il riepilogo del profilo si ferma a 200 e non lo dice | **CHIUSO** | 220 sessioni importate → `/profilo`: «ALLENAMENTI **220** · VOLUME 365 880 kg · SERIE 660». Aggregazione separata dalla lista (`profilo-view.tsx:80`, `aggregateCompletedSessions`) |
| **GRAVE 4** | La catena `Invio` si spezza su REPS a 375px | **CHIUSO** (con un residuo: DIFETTO 2) | 375 / 768 / 1440, RPE spento: `Invio` in KG → «Ripetizioni, serie 1…», `Invio` in REPS → «**Completa serie 1** di Panca piana (Bilanciere), 80 chili per 10 ripetizioni». Il `<select>` RPE non è più nemmeno nel DOM quando la colonna è spenta (`rpe={"nelDom":false}`) — più forte del filtro per visibilità |
| **GRAVE 5** | `/sessione` e il riepilogo senza `<main>`, `<h1>`, skip link | **CHIUSO** | 18 rotte controllate: ovunque `main=1 h1=1 #contenuto=MAIN`, titoli univoci. `/sessione` viva: `h1="Sessione libera"`, esercizi `h2`, `Tab` → «Vai al contenuto» → `Invio` → `MAIN#contenuto` |
| **GRAVE 6** | LCP oltre budget alla prima visita | **MIGLIORATO, non chiuso** | Misura diretta CDP a 375 con Fast 3G + CPU ×4, cache vuota e SW bloccato: **2 188-2 328 ms** (prima 3 120-3 412 ms) con ~340 KB (prima ~1 000 KB). Lighthouse mobile però dà ancora **3,8-4,5 s**. Vedi §5 |
| MINORE 1 | `aria-hidden-focus` col menu esercizio aperto | **CHIUSO** | axe: 0 violazioni su tutte le rotte e tutti gli stati, 375 e 1440 |
| MINORE 2 | Accordi grammaticali al singolare | **CHIUSO** | «1 allenamento», «Importato 1 allenamento e 0 misurazioni», nessun «Dal oggi» |
| MINORE 3 | «TEMPO IN PALESTRA 12000 min» | **CHIUSO** | `/profilo` con 220 sessioni → «TEMPO **9 g 4 h**» |
| MINORE 4 | Nome accessibile balbettante sui tipi di serie | **CHIUSO** | «Serie 1, tipo: drop set. Cambia tipo o elimina» (glifo `D`), «Riscaldamento 1. Cambia tipo o elimina» (glifo `W`) — §8.3 rispettata, nessuna ripetizione |
| MINORE 5 | Pulsante centrale della pill timer alto 42px | **CHIUSO** | Nessun bersaglio sotto i 44px in `/sessione` a nessuna delle cinque larghezze |
| MINORE 6 | `heading-order` su tre rotte, `region` su `/impostazioni*` | **CHIUSO** | axe pulito; il titolo di sezione sta dentro `<main>` (`settings-two-pane.tsx:105`) |
| MINORE 7 | La `Description` dei fogli ripete il titolo | **CHIUSO** | axe pulito sui fogli; nessun doppione nel foglio «Perché questo carico» |
| MINORE 8 | Scroll orizzontale a zoom 200% su telefono | **APERTO** (DIFETTO 6) | A 188 px CSS: documento `234/188`. **La tabella delle serie è però risolta** (`168/168`, prima `234/188`): ora sborda il solo pulsante `TERMINA` |

**14 su 15 chiusi.** L'unico rimasto è quello che il primo audit stesso dichiarava non
essere una violazione WCAG.

---

### 4. Difetti nuovi, ordinati per danno all'utente

#### DIFETTO 1 (grave) — Il programma promette uno split e ne costruisce un altro

*Riproduzione* — `/trainer/questionario`: Ipertrofia · nessun muscolo · preset
**`Corpo libero`** · Intermedio · **3 giorni** · 60 min.

*Output reale*

```
passo 5, anteprima : "3 giorni → Push/Pull/Legs"
passo 6, riepilogo : "3 giorni da 60 minuti · Push/Pull/Legs"
giorni generati    : Giorno A · Full body A · Giorno B · Full body B · Giorno C · Full body C
program.name       : "Ipertrofia · 3 giorni · 8 settimane"     <- non nomina lo split
```

Stesso effetto con `Corpo libero` a 6 giorni: promesso `Push/Pull/Legs ×2`, costruito
`Full body` ×3 ripetuto.

*Causa* — `splitLabel(days, level)` (`src/lib/trainer/generator.ts:208` → `splitFor`,
`src/lib/trainer/splits.ts:219`) è funzione **del solo numero di giorni e del livello**:
non vede l'attrezzatura. Il generatore però ripiega su `fallbackSplit`
(`src/lib/trainer/splits.ts:348`) quando il catalogo non regge lo split scelto. Il
questionario mostra l'etichetta a `src/lib/trainer/questionnaire.ts:301` (passo 5) e a
`questionnaire.ts:272` (passo 6), entrambe prima che il generatore decida.

*Aggravante di coerenza* — il commento di `fallbackSplit` (`splits.ts:346`) dichiara «il
nome del programma porta lo split che è uscito», ma `generator.ts:192` compone il nome
come `${obiettivo} · ${giorni} giorni · ${settimane} settimane`: lo split non compare da
nessuna parte. Non c'è **nessun punto** in cui l'app dica all'utente che lo split è
cambiato.

*Lo stesso scollamento sul percorso di rifiuto* — preset `Palla medica`, 4 giorni: il
passo 6 dice «4 giorni da 60 minuti · **Upper/Lower ×2**» e l'errore risponde «Il giorno
«**Full body A**» resterebbe sotto i 4 esercizi: solo palla medica non copre abbastanza
movimenti.» L'utente non ha mai visto nominare «Full body A».

*Perché conta* — §4.23 rende l'anteprima dello split un contratto («lo si mostra subito»)
e §6.8 la mette fra i punti d'attrito risolti. È la stessa classe di GRAVE 3 del primo
audit: un dato mostrato con sicurezza che non corrisponde a quello che il prodotto fa.

*Correzione* — calcolare lo split effettivo (compreso il ripiego) **prima** di mostrarlo,
passando l'attrezzatura a `splitLabel`; oppure, se il ripiego può scattare solo in
generazione, aggiungere lo split al nome del programma e una riga sulla dashboard («Con
il solo corpo libero ho costruito un Full body ×3 invece del Push/Pull/Legs»).

*Ingegnere* — `frontend-engineer`.

---

#### DIFETTO 2 (medio) — Con la colonna RPE accesa la catena `Invio` muore sull'RPE

*Riproduzione* — Impostazioni → In palestra → **Mostra la colonna RPE: Sì**. Sessione con
un esercizio, 375px: fuoco su KG, `80` `Invio` `8` `Invio` `7` `Invio` `Invio`.

*Output reale*

```
inizio        : Peso in chili, serie 1, Panca piana (Bilanciere)
Invio in KG   : Ripetizioni, serie 1, Panca piana (Bilanciere)
Invio in REPS : RPE da 1 a 10, serie 1, Panca piana (Bilanciere)
Invio in RPE  : RPE da 1 a 10, serie 1, Panca piana (Bilanciere)   *** fermo ***
Invio ancora  : RPE da 1 a 10, serie 1, Panca piana (Bilanciere)   *** fermo ***
serie 1 completata? false
```

Con la colonna RPE spenta (default) la catena arriva fino in fondo: è il caso chiuso da
GRAVE 4.

*Causa* — `src/components/session/set-row.tsx:210-230`: il `<select>` dell'RPE riceve
`data-set-focus` quando la colonna è attiva (riga 211) e quindi **entra** nella catena,
ma non ha nessun `onKeyDown`. I due campi numerici chiamano `focusNextField` su `Invio`
(`src/components/session/number-field.tsx:122`), il check lo chiama sul click
(`set-row.tsx:240`): il select no. La catena ci entra e non ne esce.

*Perché conta* — §8.4: «`Invio` dentro KG → REPS. `Invio` dentro REPS → check. […] È
l'unico shortcut del sistema ed è quello che vale.» Chi accende l'RPE — cioè chi usa
l'app sul serio — perde lo shortcut a metà e deve tornare al `Tab`. GRAVE 4 è chiuso per
il default e aperto per l'opzione.

*Correzione* — sul `<select>` di `set-row.tsx:210`:
`onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextField(e.currentTarget); } }}`.

*Ingegnere* — `frontend-engineer`.

---

#### DIFETTO 3 (medio) — Due stati «non trovato» senza `<h1>`

*Riproduzione* — `/esercizi/lib-non-esiste-affatto` e `/profilo/sessione/non-esiste`.

*Output reale*

```
/esercizi/lib-non-esiste-affatto    main=1  h1=0  []   "Esercizio non trovato / Questo esercizio non esiste più…"
/profilo/sessione/non-esiste        main=1  h1=0  []   "Allenamento non trovato / Questo allenamento non esiste più…"
/trainer/giorno/non-esiste          main=1  h1=1  ["Giorno del programma"]      <- corretto
```

*Perché conta* — §8.9: «Ogni rotta dell'app monta esattamente un `<main id="contenuto">`
e **esattamente un `<h1>`**. Senza eccezioni.» Le rotte nuove del Trainer rispettano la
regola anche nello stato d'errore; le due rotte v1 no. È lo stesso difetto di GRAVE 5,
sopravvissuto negli stati di errore.

*Correzione* — promuovere «Esercizio non trovato» / «Allenamento non trovato» a `<h1>`,
come fa già `/trainer/giorno/[id]` con «Giorno del programma».

*Ingegnere* — `frontend-engineer`.

---

#### DIFETTO 4 (medio) — Il manifest PWA apre ancora sulla home della v1

*Output reale* — `GET /manifest.webmanifest` (`content-type: application/manifest+json`):

```json
"id": "/allenamento",   "start_url": "/allenamento"
```

*Dove* — `src/app/manifest.ts:14` e `src/app/manifest.ts:21`.

*Perché conta* — §6.1 della v2: «`/` → redirect a **/home** ← era /allenamento», e
`src/app/page.tsx:5` fa esattamente quello. L'app installata dal telefono si apre quindi
su una schermata diversa dalla home dichiarata del prodotto: la tab 1 del guscio è `Home`,
ma la PWA parte dalla tab 2. Cambiare `id` dopo la pubblicazione rinomina l'installazione:
va fatto **ora**, prima che qualcuno installi.

*Correzione* — `id` e `start_url` a `/home`; valutare uno shortcut `Trainer`.

*Ingegnere* — `ship-engineer` (con `frontend-engineer` per il file).

---

#### DIFETTO 5 (minore) — `aria-rowcount` assente sulla libreria virtualizzata

*Riproduzione* — `/esercizi` a 1440px, 269 voci.

```
conteggio mostrato : "269 esercizi"
righe nel DOM      : 44         (virtualizzazione: corretta)
aria-rowcount      : assente
```

*Perché conta* — §8.9 e §8.10 chiedono entrambe `aria-rowcount` esposto sul contenitore
virtualizzato: senza, uno screen reader annuncia «riga 12 di 44» e l'utente crede che la
libreria abbia 44 esercizi.

*Nota positiva sulla stessa schermata* — la libreria a 269 voci è **fluida**: primo
contenuto **599 ms**, 293 nodi DOM, ricerca «panca» → 33 voci in **720 ms**, dieci scroll
da 1200px in **1 216 ms** con il conteggio nodi fermo a 293.

*Ingegnere* — `frontend-engineer`.

---

#### DIFETTO 6 (minore) — Zoom 200% su telefono: ora sborda `TERMINA`

*Riproduzione* — `/sessione` con un esercizio a **188 px CSS** (= 375px a zoom 200%).

```
documento          : scrollWidth 234 / clientWidth 188      (46px di eccedenza)
tabella delle serie: 168 / 168                              <- RISOLTA (prima 234/188)
chi sborda         : BUTTON "TERMINA"  right=202  w=98
```

**Non è una violazione WCAG**: 1.4.10 chiede il reflow fino a 320 px CSS, e a 320px non
c'è scroll orizzontale (verificato: `no`). È il residuo di MINORE 8, ridotto a un solo
elemento: il pulsante `TERMINA` dell'header di sessione non si stringe.

*Ingegnere* — `frontend-engineer`.

---

#### DIFETTO 7 (minore) — Le celle del calendario scendono a 37px a 1280 e 1440

*Output reale* — `/profilo`, cella del `role="grid"` misurata:

```
 375px  44x64      768px  81x64      1024px  92x64
1280px  37x64  <<<       1440px  37x64  <<<
```

§8.10 chiede «Area di cella ≥ 44×44 anche a 375px (misurata, non stimata: 45,5px)». A 375
il contratto è rispettato al pixel; da 1280 il calendario passa nella colonna destra e si
stringe sotto i 44px. Sopra i 24px di WCAG 2.5.8, quindi non è una violazione WCAG: è una
violazione del contratto del design system.

*Ingegnere* — `frontend-engineer`.

---

#### DIFETTO 8 (minore) — `aria-invalid` su un `<div>` senza ruolo, nel questionario

*Riproduzione* — `/trainer/questionario`, premere `Avanti` senza rispondere.

```
aria-invalid    : DIV.mt-5  invalid=true  describedby=_r_0_
aria-describedby: DIV -> _r_0_
focus           : P#_r_0_ tabindex="-1" "Scegli un obiettivo per continuare."
fieldset        : invalid=null  describedby=null
```

Il messaggio è visibile, il fuoco ci va davvero e il `<p>` è focalizzabile: la parte
difficile di §8.10 è fatta. Ma `aria-invalid` sta su un `<div>` **senza `role`**, dove
gli screen reader lo ignorano; il `<fieldset>` che contiene la domanda non porta nulla.

*Correzione* — spostare `aria-invalid`/`aria-describedby` sul `<fieldset>` o dare al
contenitore `role="radiogroup"`.

*Ingegnere* — `frontend-engineer`.

---

#### DIFETTO 9 (minore) — Un import senza esercizi svuota la libreria per sempre

*Riproduzione* — importare un backup Lifted valido il cui `data.exercises` sia `[]`.

*Output reale*

```
subito dopo l'import           : exercises = 0,  PR orfani = 15/15
dopo una visita a /esercizi    : exercises = 0   <- nessuna riseminatura
/esercizi                      : pannello dettaglio vuoto, nessun elenco, nessun EmptyState
```

`Cancella tutti i dati` invece risemina (verificato: 269 esercizi alla visita successiva).
L'import non ha lo stesso paracadute e non c'è modo di tornare indietro se non cancellando
tutto.

*Contesto che attenua* — un export **vero** porta sempre la libreria: verificato,
`data.exercises` = 269 voci, e il round trip export → cancella → import è **identico**
(0 PR orfani, 0 «Esercizio rimosso»). Anche un v1 realistico (con la sua libreria v1 e gli
id vecchi `lib-panca-piana-con-bilanciere`) importa pulito e ricollega i PR. Il caso si
raggiunge solo con un file modificato a mano — ma il costo è la libreria persa in silenzio.

*Correzione* — chiamare `ensureSeeded` dopo un import che lascia `exercises` vuoto.

*Ingegnere* — `frontend-engineer`.

---

#### OSSERVAZIONE — `/impostazioni/dati` a 375px non ha nessun landmark di navigazione

Sotto 1024, `/impostazioni/dati` monta `nav = 0` (zero `<nav>` nel documento);
`/impostazioni` ne ha uno, ma non è `aria-label="Navigazione principale"`. È il pattern
drill-down voluto da §4.28 e non lo segnalo come difetto — lo registro perché §8.9 è
scritta come «**un solo** `<nav aria-label="Navigazione principale">`» e zero è l'altro
modo di non averne uno.

---

### 5. Numeri

#### Lighthouse 13.5.0 — Edge via `CHROME_PATH`

| rotta | form factor | Perf | A11y | Best Pract. | SEO | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|---|---|---|
| `/home` | mobile | 88 | **100** | 100 | 60* | 0,8 s | **3,9 s** | 20 ms | 0.029 | 1,2 s |
| `/home` | desktop | 99 | **100** | 100 | 60* | 0,2 s | 0,9 s | 0 ms | 0.021 | 0,4 s |
| `/trainer` | mobile | 88 | **100** | 100 | 60* | 0,8 s | **3,9 s** | 10 ms | 0.000 | 1,2 s |
| `/trainer` | desktop | **100** | **100** | 100 | 60* | 0,2 s | 0,8 s | 0 ms | 0.000 | 0,4 s |
| `/esercizi` | mobile | 84 | **100** | 100 | 60* | 0,8 s | **4,5 s** | 20 ms | 0.000 | 1,3 s |
| `/esercizi` | desktop | **100** | **100** | 100 | 60* | 0,2 s | 0,7 s | 0 ms | 0.000 | 0,4 s |
| `/statistiche` | mobile | 89 | **100** | 100 | 60* | 0,8 s | **3,8 s** | 10 ms | 0.000 | 1,2 s |
| `/statistiche` | desktop | 99 | **100** | 100 | 60* | 0,2 s | 0,9 s | 0 ms | 0.000 | 0,4 s |
| `/sessione`† | mobile | 86 | **100** | 100 | 60* | 0,8 s | **4,2 s** | 10 ms | 0.006 | 1,5 s |

\* SEO 60 = `noindex` voluto dalla spec, **non** un difetto (come nel primo audit).
† `/sessione` senza sessione attiva reindirizza a `/allenamento`: questi numeri sono di
`/allenamento` (`finalDisplayedUrl` lo conferma). Vedi «Non verificato».

**A11y 100 su tutte le rotte e tutti i form factor**, ora su cinque rotte invece di tre,
comprese le due nuove.

#### Core Web Vitals misurati a mano (CDP), 375px — Fast 3G + CPU ×4

Prima visita, cache vuota e service worker bloccato:

| rotta | FCP | **LCP** | CLS | trasferito | budget LCP < 2,5 s |
|---|---|---|---|---|---|
| `/home` | 856 ms | **2 300 ms** | 0.000 | ~350 KB | ✓ |
| `/trainer` | 816 ms | **2 328 ms** | 0.000 | ~359 KB | ✓ |
| `/esercizi` | 828 ms | **2 228 ms** | 0.000 | ~340 KB | ✓ |
| `/statistiche` | 804 ms | **2 188 ms** | 0.000 | ~333 KB | ✓ |

Visita successiva, service worker `activated`:

| rotta | FCP | LCP | CLS |
|---|---|---|---|
| `/home` | 68 ms | **180 ms** | 0.0301 |
| `/trainer` | 56 ms | **156 ms** | 0.000 |
| `/esercizi` | 56 ms | **228 ms** | 0.0001 |
| `/statistiche` | 68 ms | **164 ms** | 0.000 |

**Confronto con il primo audit, stesso metodo e stessa macchina:** `/allenamento` a freddo
passava **3 412 ms / ~1 043 KB**; le rotte equivalenti oggi stanno a **2 188-2 328 ms /
~340 KB**. Il carico trasferito è sceso di circa tre volte e l'LCP di circa un secondo.

**Come leggere i due numeri, onestamente.** Lighthouse simula (Lantern) e resta a
3,8-4,5 s; la misura diretta osserva il caricamento vero e sta sotto i 2,5 s. Sono due
strumenti che misurano due cose: **non dichiaro GRAVE 6 chiuso**, perché lo strumento che
il primo audit ha usato per aprirlo continua a dire «fuori budget», e `/esercizi` a 4,5 s
è il numero peggiore dell'intero progetto. Dichiaro che è **migliorato in modo misurabile**
e che la scelta di quale strumento faccia fede è del team, non mia. Le indicazioni di
Lighthouse sono le stesse del primo giro: `unused-javascript` ~25 KB,
`legacy-javascript` ~13 KB, `render-blocking-insight` ~130 ms.

#### Carico, programmi lunghi, concorrenza

| Misura | Valore |
|---|---|
| Import di 220 sessioni | 5,1 s, libreria e PR ricalcolati |
| Programma massimo generabile dalla UI (6 giorni × 8 settimane) | 48 giorni, 240 esercizi, **56,7 KiB** in un solo documento |
| `TERMINA` su quel programma (progressione + riscrittura integrale) | **701 ms** fino al riepilogo |
| Render di `/trainer` con quel programma | 581-599 ms, **486 nodi DOM** |
| Render di `/trainer/progressione` | 574 ms |
| `/esercizi` con 269 voci | 599 ms, 293 nodi, 44 righe montate su 269 |

#### Suite del progetto (riprodotte)

```
pnpm typecheck   → pulito
pnpm lint        → pulito (1 warning noto: react-hooks/incompatible-library
                   su useVirtualizer, src/components/exercises/exercise-pane-list.tsx:130)
pnpm test        → Test Files 24 passed (24) · Tests 315 passed (315)
pnpm e2e         → 253 passed, 2 skipped (10.4m)   [375/768/1024/1280/1440, axe incluso]
pnpm build       → exit 0 · 86 voci in precache (2060.41 KiB) · 33 pagine
```

**Le suite non vedono il bloccante**: `e2e/trainer.spec.ts` genera sempre il programma su
un database senza storico di sessioni, che è l'unico caso in cui la generazione funziona.
Serve un test che alleni **prima** e generi **dopo**.

---

### 6. Accessibilità

#### axe-core 4.13.0 — 21 combinazioni rotta/stato × 2 larghezze

Tag: `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`.

```
375px  : 21 scansioni, 0 violazioni
1440px : 21 scansioni, 0 violazioni
```

Coperte: `/home` `/allenamento` `/trainer` `/esercizi` `/profilo` `/misure`
`/statistiche` `/impostazioni` `/impostazioni/dati` `/impostazioni/app`
`/impostazioni/allenamento` `/impostazioni/info` `/allenamento/routine/nuova`
`/esercizi/nuovo` `/trainer/questionario`, più gli stati:
**questionario con errore di validazione**, **`/trainer` con programma attivo e card
«Oggi»**, **`/trainer/giorno/[id]`**, **foglio «Perché questo carico» aperto**,
**`/trainer/progressione`**.

**Da 42 violazioni a 0.** È il risultato più netto del secondo giro.

#### Verificato a mano

**Calendario del profilo, con la sola tastiera** (§4.27, §8.10) — `/profilo`, 220 sessioni:

```
role=grid · aria-labelledby=_r_n_ · 42 celle · 1 sola cella nel tab order (roving tabindex)
<th scope="col"> con il giorno per esteso: "L/LUNEDÌ" … "D/DOMENICA"
etichette complete: "23 settembre 2026, oggi, 1 allenamento: Push A"
                    "2 settembre 2026, 1 allenamento: Push A"
                    "24 settembre 2026, nessun allenamento"

ArrowRight -> 24 settembre    ArrowRight -> 25 settembre    ArrowDown -> 2 ottobre
Home       -> 28 settembre    End        -> 4 ottobre       PageDown  -> 4 novembre
PageUp     -> 4 ottobre       ArrowLeft  -> 3 ottobre
annuncio #sr-system dopo il cambio mese: "ottobre 2026"   (una volta, non per cella)
```

Tutto §8.10 rispettato tranne la dimensione cella a ≥1280 (DIFETTO 7).

**`prefers-reduced-motion`** — sessione con il timer portato sotto i 10 secondi con
`Togli 15 secondi`:

```
no-preference : 2 animazioni, di cui 1 INFINITA
reduce        : 0 animazioni, 0 infinite
```

L'animazione infinita **sparisce**, non si accorcia. `[role="timer"]` ha
`aria-live="off"`, come chiede §8.5.

**Catena `Invio` e nomi accessibili in sessione** — vedi GRAVE 4 (chiuso) e DIFETTO 2
(residuo). Tipi serie: glifo `W`/`D`/`F` sempre presente nella cella, numerazione delle
serie allenanti ricalcolata, nomi §8.3 corretti.

**Struttura, cinque larghezze × dieci rotte** (375 / 768 / 1024 / 1280 / 1440):
un solo `<nav aria-label="Navigazione principale">`, un solo `<main>`, un solo `<h1>`
ovunque; **zero scroll orizzontale a ogni larghezza**; `<aside aria-label="Riepilogo e
azioni rapide">` presente **solo da 1280**, come da §7.5.

**§8.10 — nessun dato vive solo nella colonna destra**: diffate le stringhe di `/home`,
`/trainer`, `/profilo`, `/allenamento`, `/trainer/progressione` a **1279** e a **1280**.
Nessun dato perso. Il calendario, unico candidato, è presente a **tutte** le larghezze
(42 celle a 375, 768, 1024, 1279, 1280, 1440): da 1280 entra nell'`<aside>` e guadagna il
titolo «Calendario», sotto sta nella colonna centrale. **Contratto rispettato.**

**Zoom e reflow** — a 320 px CSS nessuno scroll orizzontale; a 188 px CSS resta
l'eccedenza del DIFETTO 6. `<meta name="viewport" content="width=device-width,
initial-scale=1">`: zoom non disabilitato. `lang="it"` sull'`<html>`.

**Bersagli sotto i 44px** — nessuno in `/sessione`, `/trainer`, `/esercizi`, `/misure`,
`/allenamento`. Su `/home` e `/profilo` sono link di testo inline nelle card del feed
(«Push A» 58×20, «Pull B» 47×20); su `/statistiche` i nomi esercizio nella lista PR
(fino a 23×24). Sono link di testo, non controlli, e restano sopra la soglia di
WCAG 2.5.8 salvo i 20px di altezza delle due voci del feed.

---

### 7. I punti dichiarati fragili dall'ingegnere — esito

| Punto | Esito | Prova |
|---|---|---|
| **Orologio del ciclo — mezzanotte** | **Regge** | Programma generato alle `23:59:00` locali; alle `00:05` la dashboard dice già «OGGI · GIOVEDÌ 24 SETTEMBRE — Giorno B». Il giorno A resta `prevista` e nessun dato si perde; il costo è che la sua finestra è durata un minuto |
| **Orologio del ciclo — ora legale** | **Regge** | Programma del 22 ottobre 2026, attraversata la fine dell'ora legale italiana (25 ottobre): il 25 mostra correttamente «Giorno C», il 29 ottobre (settimana 1 chiusa a vuoto) scatta «Hai saltato la settimana 1». `weekEnd` usa `setDate(+7)` su una data locale (`clock.ts:196`), che è la forma corretta |
| **Orologio del ciclo — fuso orario** | **Regge** | Contesto `America/Los_Angeles`: `dayKey` (`clock.ts:236`) lavora in ora locale e il giorno resta il giorno giusto |
| **Programmi lunghi (documento unico riscritto per intero)** | **Regge, e 12 settimane non è raggiungibile** | `DEFAULT_WEEKS_TOTAL = 8` (`generator.ts:52`) e nessun controllo in UI lo cambia: il massimo è **6 × 8 = 48 giorni / 240 esercizi / 56,7 KiB**. `writeProgram` riscrive tutto a ogni decisione: **701 ms** per un `TERMINA` completo, 581-599 ms per il render di `/trainer`. Non è un problema alla scala raggiungibile |
| **Due schede, due `TERMINA` in parallelo** | **Regge** | Entrambe le schede portate dentro la sessione viva (`TERMINA` visibile in tutte e due), click in `Promise.all`. Risultato: **1 sessione salvata, 0 attive, 1 giorno completato, esattamente 5 decisioni di progressione** (una per esercizio, nessun doppione), volume corretto. La seconda scheda va in timeout perché il pulsante sparisce: è la protezione che funziona |
| **`reduceDays` / `regenerateFromToday` abbandonano il programma in corso** | **Peggio: non funzionano affatto** | Vedi BLOCCANTE 1. Senza storico `reduceDays(3)` fa il suo lavoro (vecchio programma → `abandoned`, nuovo «Ipertrofia · 3 giorni · 8 settimane»), ma riparte da **settimana 1 di 8** e il registro delle decisioni resta (corretto, «sono successe»). Con storico entrambe falliscono |

---

### 8. Il Trainer, percorso per intero

| Cosa | Esito |
|---|---|
| Questionario a 375, sei passi | **OK**. Barra `role="progressbar"` con `aria-valuenow/min/max` e `aria-valuetext="Passo 1 di 6"` |
| Bozza ripresa | **OK** (coperto anche da `e2e/trainer.spec.ts:140`) |
| Validazione senza risposta | **OK sul comportamento**: il primario resta abilitato, il messaggio «Scegli un obiettivo per continuare.» compare sotto la domanda e **il fuoco ci va davvero** (`P#_r_0_ tabindex="-1"`). Difettoso il cablaggio ARIA: DIFETTO 8 |
| Massimo 2 muscoli | **OK**: contatore «1 DI 2» → «2 DI 2», il terzo click non seleziona (`.XX....`) |
| Preset attrezzatura | **OK**: 4 preset + 14 caselle. `Solo manubri` → Manubri + Corpo libero |
| Errore «nessun attrezzo» con via d'uscita | **OK**: «Senza attrezzi posso generare solo esercizi a corpo libero.» + `Va bene, corpo libero` |
| Split mostrato prima di generare | **Presente ma sbagliato quando scatta il ripiego**: DIFETTO 1 |
| Attrezzatura povera (solo manubri) | **OK**: programma coerente, solo esercizi Manubri e Corpo libero — `Panca piana (Manubri)`, `Rematore con manubrio a un braccio (Manubri)`, `Pull up (Corpo libero)`… nessun bilanciere, nessun cavo |
| Attrezzatura impossibile (solo palla medica) | **OK, rifiuta e spiega**: «Il giorno «Full body A» resterebbe sotto i 4 esercizi: solo palla medica non copre abbastanza movimenti.» e **nulla scritto in IndexedDB**. Stesso esito con le sole bande |
| Card «Oggi» → sessione con i carichi nei campi | **OK**: alla settimana 2, **17 campi KG su 17 con `value`** (`62,5`, `65`…) e la settimana precedente come `placeholder`. Alla settimana 1 i campi sono vuoti, che è la regola `first-time` di §4.25, non un difetto |
| `trainerDayId` sulla sessione | **OK**: `{"trainerDayId":"a2c0901a-…","routineName":"Giorno A · Parte alta A"}` |
| Allenamento registrato → il carico cambia e il perché lo spiega | **OK**. Card «Cosa cambia la prossima volta» sul riepilogo: `Panca piana 62,5 kg · +2,5 kg — 4 serie su 4 al tetto, RPE medio 8 · Completa 4×8 a 62,5 kg con RPE ≤ 8 e la prossima volta salgo a 65 kg`. Incrementi giusti per attrezzo: +2,5 kg bilanciere alto, +5 kg cavi/macchina |
| Le nove regole, viste vive | `double-progression`, `reps-first` («Porta la serie da 8 a 9 ripetizioni»), `hold-on-miss`, `first-time`, `skip-hold`, `planned-deload` (settimane 4 e 8 marcate «scarico»), `manual`. Non viste: `rpe-cap`, `deload-on-miss` |
| Foglio «Perché questo carico», **con** storico | **OK, tutti e quattro i blocchi**: regola col nome («Doppia progressione») · i dati («Serie completate 4 su 4 / Ripetizioni 8, 8, 8, 8») · il conto («da 60 kg → 62,5 kg (+2,5 kg)») · **«CHE COSA SERVE PER IL PROSSIMO PASSO»**. La sessione citata è un **link reale e verificabile** (`/profilo/sessione/0eda0a63-…`). `Esc` chiude |
| Foglio, **senza** storico | **OK**: «Prima volta» + «Nessun carico proposto: parti leggero e tara tu il peso sulla prima serie» + la frase del prossimo passo, obbligatoria e presente |
| `Non sono d'accordo` → override | **OK**: 62,5 → 70 kg, `Annulla` **non** applica (verificato: carico invariato, nessuna decisione `manual`), `Usa questo carico` sì. Il carico diventa la nuova base (`@70`) |
| Registro con filtro | **OK**: `Tutte` / `Aumenti` (2) / `Riduzioni` (0, «Nessuna riduzione di carico finora.» + `Azzera filtri`) / `Scarichi` (0, con il suo messaggio) / `Tue scelte` → «62,5 kg → 70 kg · Tua scelta: Carico scelto da te il 23 settembre». Lo stato vive nella query string (`?filtro=aumenti`) |
| Settimana saltata — tre azioni, **nessuna preselezionata** | **OK**: banner `role="status"`, «Hai saltato la settimana 2: nessun allenamento registrato.» + «**Non tocco niente finché non decidi.**» + `Ripeti la settimana 2` · `Vai alla settimana 3` · `Rigenera da qui`, tutte con `aria-pressed=null` e `aria-checked=null`, nessuna a fuoco |
| Due settimane saltate | **OK sul banner**: «Hai saltato le settimane **2 e 3**.» + «4 giorni non stanno entrando nella tua settimana. Posso adattare il programma invece di insistere.» + la **quarta** azione `Riduci a 3 giorni a settimana`. **Ma l'azione non funziona** con storico: BLOCCANTE 1 |

**Nota sul conteggio delle settimane saltate.** `programClock` si ferma alla **prima**
settimana vuota (`clock.ts:40-44`), quindi chi genera un programma e non si allena per tre
settimane vede per sempre «Hai saltato la settimana 1» con tre azioni: lo stato «due
settimane saltate» si raggiunge solo **dopo** aver già scelto `Vai alla settimana N`. È
coerente con «il programma resta fermo finché non decidi» e non lo segnalo come difetto,
ma è bene saperlo: la quarta azione è più rara di quanto §4.24 lasci intendere.

---

### 9. Regressioni sul già fatto

| Area | Esito |
|---|---|
| Sessione: tipi serie W/D/F | **OK** — glifo nella cella, numerazione allenante ricalcolata, nomi §8.3 corretti |
| Sessione: RPE | **OK** come dato, **difettoso** nella catena `Invio` (DIFETTO 2) |
| Sessione: timer | **OK** — `role="timer"` con `aria-live="off"`, `−15`/`+15`/pausa/salta, pulsazione sotto i 10 s che sparisce con `reduce` |
| Sessione: volume live | **OK** — «640 kg» in header, «Serie completata. 1 serie, volume totale 640 kg.» in `aria-live` |
| Calcolatore dischi | **OK, chiuso GRAVE 1** |
| Calcolatore riscaldamento | **OK** — target 100: `W1 Bilanciere 20×10 30 s · W2 50% 50×8 45 s · W3 70% 70×5 60 s · W4 87,5% 87,5×2 90 s` |
| PR | **OK** — sessione 1 (80×8): «3 nuovi record, primo record»; sessione 2 (90×8): «2 nuovi record», «+12,67 sul record precedente», «+80 sul record precedente». Il pari merito sulle reps **non** genera record |
| **Eliminare la sessione del record** | **OK** — dialog «Volume, serie e PR calcolati da questa sessione verranno ricalcolati.» Prima: `e1rm=114 prec=101.33 · volume=720 prec=640`. Dopo: `e1rm=101.33 · volume=640 · reps=8`, nessun badge orfano |
| Misure e grafici | **OK, chiuso GRAVE 2** |
| Statistiche | **OK** — intervalli `SETTIMANA`/`MESE` e `1M`/`3M`/`6M`/`1A`/`Tutto`, «132 allenamenti nell'intervallo scelto» coerente con i 220 totali del profilo |
| Export JSON | **OK** — `formatVersion: 2`, `counts` con le tre tabelle Trainer, **269 esercizi inclusi** |
| Round trip export → cancella → import | **OK, identico** — conteggi uguali su tutte le 11 tabelle, 0 PR orfani, Trainer ripristinato («FATTO OGGI») |
| **Import di un backup v1** | **OK** — `formatVersion: 1` accettato, Trainer resta vuoto senza errori, PR ricollegati (0 orfani), id v1 `lib-panca-piana-con-bilanciere` gestiti |
| **Import v2 senza tabelle Trainer** | **OK** — importa, libreria intatta (269), Trainer vuoto |
| `formatVersion: 3` | **OK, rifiutato** — «Questo backup viene da una versione più recente di Lifted. Aggiorna l'app prima di importarlo.», **0 scritture** |
| File ostili (non-JSON, altra app, corrotto) | **OK, 3 su 3 rifiutati, database mai toccato** |
| **Offline, cache calda** | **OK su tutte le rotte nuove** — `/home` `/trainer` `/esercizi` `/statistiche` `/profilo` `/misure` `/impostazioni` `/impostazioni/dati` `/trainer/progressione` tutte **HTTP 200** con l'`<h1>` giusto, compresa una `/trainer/giorno/[id]` **mai visitata prima**. Allenamento intero registrato offline → riepilogo + **25 decisioni scritte**. `ERRORI DI PAGINA: []` |
| Precache | 86 voci al build, 106 in cache a runtime; tutte le rotte nuove presenti |
| PWA | Manifest valido, 4 icone tutte 200 (192/512 `any` + `maskable`), `display: standalone`, `theme_color = background_color = #0B0C0E`, `lang: it`, `<meta name="theme-color">` nel documento. **`start_url` sbagliato: DIFETTO 4** |

---

### 10. Non verificato

1. **`/sessione` sotto Lighthouse**, di nuovo: la rotta reindirizza a `/allenamento` senza
   una sessione attiva e il marcatore di `session-entry` vive in `sessionStorage`. I
   numeri `/sessione` della tabella sono di `/allenamento`.
2. **`Genera il ciclo successivo`** dallo stato «programma finito» (§4.24): servirebbero
   otto settimane di calendario reale. È lo stesso `createProgramFromDraft` del
   BLOCCANTE 1, quindi *quasi certamente* rotto allo stesso modo, ma non l'ho eseguito.
3. **Le regole `rpe-cap` e `deload-on-miss`** non le ho viste scattare dal vivo: ci sono
   nei test unitari, non le ho provocate dal browser.
4. **12 settimane × 6 giorni**: non generabile dalla UI (`weeksTotal` è fisso a 8). Ho
   misurato il massimo reale, 6 × 8.
5. **Suono di fine recupero e vibrazione**: headless non ha uscita audio né
   `navigator.vibrate` utile. Invariato dal primo audit.
6. **Installazione PWA vera su telefono**: prompt, icona maskable ritagliata, splash,
   safe area, e soprattutto il comportamento di **iOS che cancella IndexedDB dopo 7 giorni
   di inutilizzo** per i siti non aggiunti alla schermata Home. Per un'app local-first
   resta il rischio più grande e non è verificabile da qui.
7. **Screen reader reale** (NVDA/VoiceOver): ho verificato nomi, ruoli, regioni live,
   ordine di focus e `aria-*` in modo programmatico, non ascoltato.
8. **Tocco lungo e swipe su hardware touch vero**; lo swipe-to-delete sulla riga serie.
9. **iOS Safari e Android Chrome**: tutto l'audit è Edge/Chromium con viewport emulate.
10. **L'etichetta «QUASI» sulla pill del timer** agli ultimi secondi: la pulsazione l'ho
    misurata (c'è e sparisce con `reduce`), l'etichetta testuale non sono riuscito a
    catturarla in modo affidabile. Il primo audit l'aveva vista.
11. **Storage pieno** (§5.3, «Spazio esaurito. Esporta un backup e libera spazio.»): non
    ho saturato la quota di IndexedDB.
12. **Dati di un utente vero**: tutto lo storico lungo è generato.

---

### 11. Cosa rifare prima del prossimo giro

1. **BLOCCANTE 1** — la guardia di `src/lib/trainer/rules.ts:189`. Una riga, e senza di
   essa la funzionalità di punta della v2 non esiste per nessun utente reale. Insieme:
   togliere il `catch {}` vuoto di `trainer-view.tsx:128`, che ha nascosto un `TypeError`
   dietro un messaggio che incolpa il telefono dell'utente.
2. **Un test che alleni prima e generi dopo** — la suite a 253 e2e non ha visto il
   bloccante perché parte sempre da un database senza sessioni.
3. **DIFETTO 1** — lo split promesso deve essere quello costruito, o il cambio va detto.
4. **DIFETTO 2** — `onKeyDown` sul `<select>` RPE: una riga, e chiude davvero GRAVE 4.
5. **DIFETTO 4** — `start_url`/`id` del manifest a `/home`, **prima** che qualcuno installi.
6. **DIFETTO 3, 5, 8** — `<h1>` sui due stati «non trovato», `aria-rowcount` sulla
   libreria, `aria-invalid` su un nodo con un ruolo.
7. **GRAVE 6** — decidere quale strumento fa fede sull'LCP. Se è Lighthouse, `/esercizi`
   a 4,5 s è il primo da guardare; le indicazioni sono sempre le stesse ~38 KB fra
   `unused-javascript` e `legacy-javascript` più i 130 ms di render-blocking.
8. I minori restanti (DIFETTO 6, 7, 9).

Poi si rimisura: la generazione del Trainer **con** storico, axe sulle rotte toccate,
l'LCP a freddo, e la catena `Invio` con RPE acceso.

---
---

## Primo audit — 2026-09-22

Data: 2026-09-22 · Autore: `qa-engineer` · Commit auditati: `6d7010b`, `016636e` (non pushati)
Ambiente: Windows 11, Edge via Playwright (`channel: "msedge"`), build di produzione
(`pnpm build && pnpm start`, porta 3000). `agent-browser` è bloccato dalla policy della
macchina: tutto il pilotaggio è Playwright + Edge.

---

### 1. Verdetto

**Pronto con riserve.** Nessun bloccante: l'app si costruisce, si installa, funziona
offline per intero, e tutte e sette le funzionalità della spec esistono e funzionano.
Il backup — l'unica rete di sicurezza di un'app local-first — è la parte migliore del
prodotto e ha retto ogni attacco. Restano **sei difetti gravi**, di cui due fanno dire
al prodotto cose false (il calcolatore di dischi e il riepilogo del profilo) e due
tolgono valore a funzionalità dichiarate nella spec (grafici di andamento, catena
`Invio` in sessione).

---

### 2. Bloccanti

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

### 3. Difetti ordinati

#### GRAVE 1 — Il calcolatore di dischi propone piastre che non possiedi

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

#### GRAVE 2 — I grafici di andamento sono linee piatte: l'asse Y parte da 0

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

#### GRAVE 3 — Il riepilogo del profilo si ferma a 200 allenamenti e non lo dice

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

#### GRAVE 4 — La catena `Invio` si spezza su REPS a 375px (l'unico shortcut del sistema)

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

#### GRAVE 5 — `/sessione` e `/sessione/riepilogo/[id]` non hanno `<main>`, né `<h1>`, e lo skip link non skippa

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

#### GRAVE 6 — LCP oltre budget alla prima visita su telefono

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

#### MINORE 1 — `aria-hidden-focus` (axe: *serious*) con il menu dell'esercizio aperto

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

#### MINORE 2 — Accordi grammaticali italiani mai gestiti al singolare

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

#### MINORE 3 — «TEMPO IN PALESTRA 12000 min»

`formatMinutes` (`src/lib/logic/timer.ts:88-90`) non passa mai alle ore:
`Math.round(ms / 60_000) + " min"`. Su una durata di sessione va bene, sul totale di vita
del profilo (`src/app/(tabs)/profilo/profilo-view.tsx:127`) produce un numero illeggibile.
*Correzione* — una `formatDuration` che rolla a `200 h` / `8 g 8 h` per i totali.
*Ingegnere* — `frontend-engineer`.

---

#### MINORE 4 — Nome accessibile balbettante sui tipi di serie

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

#### MINORE 5 — Il pulsante centrale della pill timer è alto 42px, non 48

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

#### MINORE 6 — `heading-order` su tre rotte, `region` su `/impostazioni*`

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

#### MINORE 7 — La `Description` dei fogli ripete il titolo

`src/components/ui/sheet.tsx:78-80`: quando non si passa `description`, viene renderizzata
una `DialogPrimitive.Description` `sr-only` con **lo stesso testo del titolo**. Risultato
all'apertura: «I tuoi dati restano su questo telefono — I tuoi dati restano su questo
telefono». Succede su tutti i fogli senza descrizione (avviso iniziale, scelta esercizi,
dischi, riscaldamento).
*Correzione* — `aria-describedby={undefined}` sul `Content` invece della descrizione fantasma.
*Ingegnere* — `frontend-engineer`.

---

#### MINORE 8 — Scroll orizzontale sulla riga serie a zoom 200% su telefono

375px a zoom 200% = 188 px CSS: `scrollWidth 234` contro `clientWidth 188`, 46px di
eccedenza sulla tabella delle serie.

**Non è una violazione WCAG**: 1.4.10 chiede il reflow fino a 320 px CSS, e **a 320px
l'app non ha scroll orizzontale** (verificato: `no`). Lo segnalo perché chi ingrandisce sul
telefono è esattamente il pubblico di un'app da palestra, e perché era nel perimetro richiesto.

---

### 4. Numeri

#### Lighthouse 13.5.0 — Edge

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

#### Core Web Vitals misurati a mano (CDP), 375px

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

#### Carico e storico lungo

| Misura | Valore |
|---|---|
| Import di 220 sessioni (~0,9 MB) | 2,6 s, 149 record ricalcolati |
| `/profilo` con 220 sessioni | 438 ms al primo contenuto, 2 278 nodi DOM |
| `/statistiche` con 220 sessioni | 81 ms al primo contenuto |
| Chunk Recharts | 403 KB, **fuori** dal percorso sessione |

#### Suite del progetto

```
pnpm typecheck   → pulito
pnpm lint        → pulito
pnpm test        → Test Files 14 passed (14) · Tests 166 passed (166) · 316 ms
pnpm e2e         → 54 passed (2.2m)   [375 / 768 / 1440, axe incluso]
pnpm build       → exit 0 · 65 voci in precache (1710.02 KiB)
```

---

### 5. Accessibilità

#### Verificato a mano

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

#### axe-core, tutte le rotte × 375 e 1440, stati inclusi

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

### 6. Le sette funzionalità della spec — percorse davvero

| § | Funzionalità | Esito |
|---|---|---|
| 3.1 | Routine illimitate, W/D/F, RPE, volume live, timer con suono | **OK**, tranne GRAVE 4 (catena `Invio`). `AVVIA` da routine precompila esercizi e valori: verificato `routineId`/`routineName` in IndexedDB e campi a `80`/`8` |
| 3.2 | Calcolatore di riscaldamento | **OK** — `Bilanciere 20×10 / 50% 42,5 (41,25) ×8 / 70% 57,5 (57,75) ×5 / 87,5% 72,5 (72,19) ×2`, con recuperi e valore teorico accanto all'arrotondato |
| 3.3 | Calcolatore dischi | **Difettoso** — vedi GRAVE 1. La parte «non arrotondare in silenzio» invece è perfetta (sotto) |
| 3.4 | Libreria + esercizi personalizzati | **OK** — 81 esercizi seminati, filtri per muscolo/attrezzo con conteggio, creazione custom con nomi che contengono `«»`, `;`, virgole e virgolette |
| 3.5 | Statistiche, 1RM, PR | **OK** nella logica, **difettoso** nella resa (GRAVE 2) e nei totali del profilo (GRAVE 3) |
| 3.6 | Misure corporee con grafici | **OK** nei dati, **difettoso** nel grafico (GRAVE 2) |
| 3.7 | Export JSON **e** CSV + import | **OK, senza riserve** |

#### Il caso «101 kg», come richiesto

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

#### Record personali, come richiesto

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

#### Backup, come richiesto

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

#### Offline reale, come richiesto

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

#### PWA

`/manifest.webmanifest`, `content-type: application/manifest+json`:
`id`, `name`, `short_name`, `description`, `lang: it`, `start_url: /allenamento`,
`scope: /`, `display: standalone`, `orientation: portrait`,
`background_color` = `theme_color` = `#0B0C0E` (= `--background`, §11.2 rispettato),
`categories`, 2 shortcut. **Quattro icone, tutte HTTP 200**: 192 e 512 `any`, 192 e 512
`maskable`. `<meta name="theme-color" content="#0B0C0E">` presente nel documento.
Manifest valido e installabile.

---

### 7. Non verificato

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

### 8. Cosa rifare prima del prossimo giro

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
