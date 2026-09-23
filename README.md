# Lifted

Diario di allenamento **local-first**: clone personale di Hevy con tutte le funzioni
Pro, senza server, senza account, senza costi. I dati vivono in IndexedDB, sul
dispositivo, e non escono mai da lì.

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · Radix UI ·
Dexie.js · Recharts · dnd kit · Serwist

> La versione precedente di questo repo (fitcoach: coach evidence-based con backend
> FastAPI) vive sul ramo `fitcoach-v1` e sul tag `fitcoach-v1.0`.

---

## Cosa fa

| | |
|---|---|
| **Allenamento** | routine illimitate per split, quick start, sessione attiva con peso, ripetizioni e RPE, tipi di serie Normale / Riscaldamento (W) / Drop (D) / Cedimento (F), volume in tempo reale, cronometro, timer di recupero fluttuante con avviso sonoro |
| **Calcolatori** | riscaldamento a percentuali progressive e calcolatore di dischi per lato, con il bilanciere visualizzato |
| **Esercizi** | libreria di **269 esercizi** in italiano — ogni combinazione movimento × attrezzo è una voce a sé (`Panca piana (Bilanciere)`, `(Manubri)`, `(Smith machine)`, `(Macchina)`) — filtri per muscolo e attrezzo, esercizi personalizzati illimitati. Da 1280px in su è a **due pannelli**: dettaglio al centro, elenco virtualizzato a destra |
| **Home** | il feed degli allenamenti, con durata, volume, record ed esercizi, e l'avvio in cima |
| **Record personali** | rilevati da soli alla chiusura della sessione su 1RM stimato, volume e ripetizioni, con il valore precedente e la sua data («112 kg, +4 sul record») |
| **Profilo** | totali di sempre, tab (Riepilogo · Statistiche · Misure), **calendario mensile** navigabile da tastiera, feed personale |
| **Statistiche** | volume settimanale e mensile, distribuzione per gruppo muscolare, andamento del 1RM stimato per esercizio, elenco dei record |
| **Misure** | peso corporeo, massa grassa e sei circonferenze, con grafico di andamento per ciascuna |
| **Backup** | export completo in JSON e CSV, ripristino da JSON in transazione |
| **PWA** | installabile su iOS e Android, **funziona completamente offline** |
| **Trainer** | **programma generato e progressivo**: sei domande (obiettivo, muscoli, attrezzatura, livello, giorni, durata) e il Trainer costruisce un ciclo di 8 settimane con routine pronte per ogni giorno, scegliendo dalla libreria reale in base a quello che hai davvero. Dopo ogni allenamento **decide da solo il carico della volta dopo** e scrive *perché*: nove regole nominate, la riga del motivo sotto ogni carico, il foglio «Perché questo carico» con i numeri e le sessioni citate come link, e un registro filtrabile di tutte le decisioni |

---

## Avvio locale

Serve **Node 24** e **pnpm 11**.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Niente `.env`: l'app non parla con nessun servizio esterno e non ha segreti — non c'è
niente da configurare, ed è una proprietà del prodotto, non una mancanza. Al primo
avvio crea il database IndexedDB `lifted`, ci scrive le impostazioni predefinite e vi
carica la libreria di esercizi.

Per ripartire da zero: **Impostazioni → Backup ed esportazione → Cancella tutti i dati**,
oppure cancella i dati del sito dal browser.

> In sviluppo il service worker è **spento** (`SerwistProvider disable`): una precache
> che si aggiorna a ogni salvataggio è solo un modo per non vedere le proprie modifiche.
> L'offline si prova su `pnpm build && pnpm start`.

### Comandi

| Comando | Cosa fa |
|---|---|
| `pnpm dev` | sviluppo |
| `pnpm build` · `pnpm start` | build di produzione e server (porta 3000) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (config Next + regole React) |
| `pnpm test` | **315** unit test con Vitest (logica pura + strato Dexie su `fake-indexeddb`) |
| `pnpm e2e` | **255** test Playwright su Edge a **375 / 768 / 1024 / 1280 / 1440**, con axe |
| `pnpm e2e:375` | solo il telefono |
| `node scripts/generate-icons.mjs` | rigenera le icone della PWA dai token |

`pnpm e2e` non costruisce da sé: prima serve `pnpm build`, poi Playwright avvia
`next start` sulla porta 3100 (o riusa quello già in ascolto).

---

## Installarla sul telefono

L'app è una PWA: si installa dal browser, senza store.

**Android (Chrome / Edge)**
1. apri l'indirizzo dove gira Lifted;
2. menu ⋮ → **Installa app** (o **Aggiungi a schermata Home**);
3. l'icona compare tra le app, e si apre a schermo intero senza barra del browser.

**iPhone / iPad (Safari — è l'unico che può installare)**
1. apri l'indirizzo in **Safari**;
2. tocca **Condividi** → **Aggiungi a Home**;
3. conferma. L'app parte in modalità standalone, con la barra di stato nel colore
   dell'app.

Dopo la prima apertura il service worker precarica tutte le schermate: da quel momento
**Lifted si apre e funziona anche in aereo**. Registrare un allenamento offline è il
caso normale, non un ripiego — in palestra la rete è quella che è.

> Su iOS i dati di un sito aggiunto alla Home sono legati a quell'installazione:
> se la rimuovi, i dati se ne vanno con lei. Fai un backup prima.

---

## Backup — leggi questa parte

I dati stanno **solo su questo dispositivo**. Non c'è un server che li tenga da parte:
se cancelli i dati del sito, cambi telefono o rimuovi l'app dalla Home, senza un backup
è finita. Per questo export e import sono funzioni di prima classe, in
**Impostazioni → Backup e ripristino**.

### Esportare

- **`Esporta backup JSON`** → `lifted-backup-AAAA-MM-GG.json`. È **l'unico formato che
  Lifted sa rileggere**: è il backup vero. Contiene esercizi, routine, storico, record,
  misure e impostazioni, con un numero di versione del formato in testa.
- **`Esporta CSV per Excel`** → tre file (`allenamenti`, `misure`, `record`). Servono a
  guardare i dati altrove, non a rientrare in Lifted.

Il CSV si apre in **Excel italiano senza aggiustamenti**: separatore `;` (Excel usa il
separatore di elenco del sistema, che in Italia è quello), decimali con la **virgola**
(`82,5` entra come numero, `82.5` diventerebbe testo o una data) e **BOM UTF-8** in
testa, altrimenti Windows legge il file come ANSI e gli accenti si rompono.

### Ripristinare

**Impostazioni → Backup → File di backup (.json)**. Il file viene letto e validato per
intero *prima* di toccare il database; poi compare una conferma che dice quanti
allenamenti, misure, routine ed esercizi stai per sovrascrivere, e offre `Esporta prima`.

La scrittura sta in **una sola transazione**: se qualcosa fallisce a metà, IndexedDB
annulla tutto e sul dispositivo resta quello che c'era. Non esiste uno stato "metà
importato".

Un file che non è un backup di Lifted viene rifiutato con una frase chiara; un backup
prodotto da una versione **più recente** dell'app viene rifiutato invece di essere letto
male. Un backup **più vecchio** si legge: i campi derivati vengono ricostruiti.

---

## Struttura

```
src/
├── app/
│   ├── layout.tsx              lang="it", font, theme-color, regioni aria-live, icone
│   ├── manifest.ts             manifest della PWA
│   ├── globals.css             TUTTI i token del design system + @theme inline
│   ├── serwist/[path]/         rotta che genera /serwist/sw.js al build
│   ├── (tabs)/                 le cinque tab: bottom nav < 1024, Sidebar ≥ 1024
│   │   ├── home/               il feed + l'avvio in cima
│   │   ├── allenamento/        quick start, routine, editor con riordino
│   │   ├── trainer/            dashboard, giorno del programma, registro delle decisioni
│   │   ├── profilo/            totali, tab, calendario mensile, feed personale
│   │   ├── esercizi/           libreria, filtri in query string, due pannelli ≥ 1280
│   │   ├── misure/             elenco metriche + dettaglio con grafico
│   │   └── statistiche/        volume, distribuzione muscolare, 1RM, record
│   ├── trainer/questionario/   le sei domande, a schermo intero e fuori dal guscio
│   ├── sessione/               sessione attiva a schermo intero + riepilogo con i PR
│   └── impostazioni/           indice + pannello, una rotta per sezione
├── components/
│   ├── ui/                     primitivi su Radix, ritemati sui nostri token
│   ├── layout/                 Sidebar, bottom nav, colonna destra, ricerca globale
│   ├── session/                NumberField, SetRow, ExerciseCard, timer, calcolatori
│   ├── trainer/                card «Oggi», accordion delle settimane, riga del perché
│   ├── charts/                 cornice e stati dei grafici + Recharts in next/dynamic
│   ├── history/ · measures/ · settings/
│   └── shared/                 EmptyState, ErrorState, Async, PRBadge, SortableList
├── lib/
│   ├── db/                     schema, migrazioni, seed, query, mutazioni, PR, backup
│   ├── logic/                  volume, 1RM, PR, statistiche, riscaldamento, dischi, timer
│   ├── trainer/                generatore, nove regole di progressione, orologio del ciclo
│   ├── backup/                 formato versionato, CSV, download
│   ├── format.ts               Intl it-IT
│   └── hooks/                  useLiveData (tre stati), useNow, useRouteId, …
└── sw.ts                       service worker
docs/
├── spec.md · spec-v2.md        il brief dell'utente e la sua revisione
├── design-system.md            token, componenti, flussi, contratto di accessibilità
├── esercizi-hevy.md            la lista da cui nasce la libreria
└── qa-report.md                l'audit che ha aperto i difetti chiusi in v2
e2e/                            Playwright: sessione, Trainer, record, backup, offline, axe
scripts/generate-icons.mjs      icone PWA generate dai token, senza dipendenze
```

---

## Dati

Tutto in IndexedDB, database `lifted`, **schema v2** (`src/lib/db/migrations.ts`).
Chi arriva dalla v1 viene migrato all'apertura e non perde niente: la prova sta in
`src/lib/db/migrations.test.ts` e, in un browser vero, in `e2e/migrazione.spec.ts`.

| Tabella | Chiave e indici |
|---|---|
| `exercises` | `id`, `&nameKey`, `name`, `muscleGroup`, `equipment`, `family`, `popularity`, `createdAt`, `[muscleGroup+equipment]`, `[family+equipment]`, `*secondaryMuscles` |
| `routines` | `id`, `order`, `name`, `split`, `updatedAt`, `lastPerformedAt`, `[split+order]` |
| `sessions` | `id`, `status`, `startedAt`, `routineId`, `[status+startedAt]`, `*exerciseIds` |
| `personalRecords` | `id`, `exerciseId`, `sessionId`, `achievedAt`, `[exerciseId+kind]`, `[exerciseId+achievedAt]` |
| `measurements` | `id`, `metric`, `date`, `[metric+date]` |
| `settings` | `id` (singleton) |
| `appMeta` | `key` (versione del seed) |
| `trainerProfile` | `id` (singleton): le risposte al questionario, bozza compresa |
| `trainerPrograms` | `id`, `status`, `startedAt`: il programma è il documento, settimane e giorni annidati |
| `trainerDays` | `id`, `programId`, `status`, `plannedFor`, `sessionId`, `[programId+weekIndex]`: **indice**, non una seconda copia — serve a `/trainer/giorno/[id]`, che è un deep link |
| `trainerDecisions` | `id`, `programId`, `exerciseId`, `decidedAt`, `[programId+decidedAt]` |

Le serie restano annidate dentro la sessione: la sessione è il documento, `*exerciseIds`
è solo un indice derivato per ritrovarla partendo da un esercizio.

---

## Come funziona il Trainer

Due pezzi, tutti e due **logica pura** (`src/lib/trainer/`, nessun browser, nessun
Dexie): si provano con i test di unità, e infatti è lì che sono provati.

### Il generatore — dal profilo al programma

1. **I pattern di movimento.** Il gruppo muscolare non basta a scrivere un allenamento:
   `chest` tiene insieme la panca e le croci, `back` tiene insieme lo stacco e il lat
   pulldown. Ogni esercizio della libreria viene classificato in uno di **sedici
   pattern** (spinta orizzontale, trazione verticale, femorali, …) a partire da
   `muscleGroup` + `mechanics` + famiglia. È quello che si bilancia.
2. **Lo split.** Il numero di giorni decide la forma della settimana — 2 → Full body ×2,
   3 → Full body ×3 o Push/Pull/Legs secondo il livello, 4 → Upper/Lower ×2, 5 →
   PPL + Upper/Lower, 6 → PPL ×2. Il questionario lo **dice al passo 5**, prima di
   generare.
3. **Gli slot.** Un giorno non è un elenco di esercizi: è un elenco di posti da riempire,
   ciascuno con un pattern e un ruolo (primario · secondario · complementare), **in
   ordine di importanza**. Quando la seduta è corta si taglia dalla coda, mai dalla testa:
   a 45 minuti resta il fondamentale e sparisce il curl.
4. **La scelta.** Ogni slot prende l'esercizio col punteggio più alto fra quelli
   **compatibili con l'attrezzatura dichiarata**: popolarità, meno la penalità per una
   famiglia già usata nel programma, più un bonus di ruolo (un fondamentale dev'essere
   multiarticolare e a carico regolabile — un push up alle bande in 5×3 è una
   progressione che non può avanzare). Mai due esercizi della stessa famiglia nello
   stesso giorno.
5. **Il ripiego.** Con il solo corpo libero un giorno di «Trazione» esiste sul foglio e
   non in palestra. Allora si ripiega sul full body, che ha slot più larghi; e se
   nemmeno quello copre petto, dorso e gambe, la generazione **rifiuta dicendo il
   motivo esatto**, invece di consegnare tre esercizi e chiamarli settimana.
6. **Volume e intensità** vengono da obiettivo × ruolo × livello, in tabella. Il livello
   corregge il **volume**, non l'intensità: al principiante meno serie, all'avanzato una
   in più sui fondamentali.

### Le nove regole di progressione

Sono **dati**, non `if` sparsi: vivono in `PROGRESSION_RULES`, e la schermata «Come
funziona la progressione» legge la stessa tabella che decide i carichi.

| Regola | Quando scatta | Effetto |
|---|---|---|
| `double-progression` | tutte le serie al tetto dell'intervallo e RPE medio entro l'obiettivo | +1 incremento, le ripetizioni tornano al fondo |
| `reps-first` | serie complete ma sotto il tetto | +1 ripetizione, carico invariato |
| `rpe-cap` | una serie allo sforzo massimo consentito | l'aumento si **dimezza**; se mezzo incremento non è caricabile, resta fermo **e lo dice** |
| `hold-on-miss` | una seduta sotto il fondo dell'intervallo | carico invariato |
| `deload-on-miss` | **due** sedute di fila sotto il fondo | −10%, arrotondato all'incremento vero |
| `planned-deload` | la settimana che arriva è di scarico | volume −40%, carico −10% |
| `skip-hold` | nessun allenamento nella settimana | nessuna progressione, il carico resta l'ultimo davvero usato |
| `first-time` | nessuno storico | nessun carico proposto: il campo resta vuoto |
| `manual` | l'hai deciso tu | il tuo valore diventa la nuova base |

Ogni decisione porta con sé i numeri che l'hanno attivata, le **sessioni citate come
link verificabili** e — obbligatoria su ogni esercizio — la frase di **che cosa serve
per il prossimo passo**. Sapere cos'è successo non serve, se non si sa cosa fare.

Gli incrementi sono **impostazioni**, non costanti: bilanciere parte alta 2,5 kg, parte
bassa 5, manubri 2, macchine e cavi 5. Niente arrotondamenti silenziosi.

---

## Decisioni che vale la pena conoscere

**Un record si batte, non si eguaglia.** Il pari merito non genera un PR. Contano solo
le serie allenanti completate: un 20 kg × 30 di riscaldamento non è un record di
ripetizioni. I tre tipi misurano tre cose diverse — `e1rm` la stima migliore di una
singola serie, `volume` il lavoro totale su quell'esercizio in quella sessione, `reps` le
ripetizioni massime di una serie.

**I record sono una tabella, non un calcolo.** Servono per dire *quando* un record è
caduto e *quale* era il precedente. Quando lo storico cambia — una sessione eliminata —
i record degli esercizi coinvolti si **ricalcolano rigiocando lo storico**, invece di
essere tolti: togliere il record migliore senza rigiocare la catena lascerebbe
«precedente: 112 kg» puntato a un allenamento che non esiste più.

**Il volume per gruppo muscolare non va tutto sul muscolo principale**, altrimenti la
panca non allenerebbe mai i tricipiti: peso 1 al principale, 0,5 a ciascun secondario,
normalizzato.

**Offline e rotte con un id.** Le pagine tipo `/esercizi/[id]` non si possono
prerenderizzare per ogni id possibile, quindi ognuna prerenderizza una **scocca** con il
segnaposto `_`; offline il service worker serve quella e la pagina legge l'id vero
dall'indirizzo (`useRouteId`). Quando il router di Next non riesce a scaricare il payload
di una rotta, la navigazione diventa un caricamento di pagina, che ripassa dalla precache.

**Recharts arriva solo dove serve** (`next/dynamic`, `ssr: false`): la sessione in
palestra non paga 300 KB di libreria grafica che non usa.

**Le icone sono generate da uno script**, non disegnate altrove: derivano dai token del
design system, e se un colore cambia si rigenerano.

**Un solo `<nav aria-label="Navigazione principale">` per documento.** Sotto 1024px è la
bottom nav, sopra è la `Sidebar` da 264px, e le due **non coesistono mai** — nemmeno con
una nascosta da `display:none`, perché una media query CSS nasconde ma non smonta. Per
questo la soglia passa da `useIsDesktop()` e non dal CSS.

**La colonna destra non è mai l'unico posto in cui vive un dato.** Sopra 1280px il suo
contenuto finisce nell'`<aside>` con un portale; sotto, **la stessa istanza** scende in
coda alla colonna centrale. Non due alberi che si somigliano, uno dei quali si dimentica
di aggiornarsi: è il guscio a garantirlo, non la buona volontà di chi scrive la pagina.

**L'inventario dei dischi si dichiara in totale e si carica per lato.** Il diviso due sta
in `toPlateInventory`, in un posto solo. Prima veniva raccolto come totale e consumato
come per-lato, e il calcolatore proponeva il doppio dei dischi che possiedi.

**L'asse Y di un grafico parte da zero solo se lo zero vuol dire qualcosa.** Peso
corporeo, circonferenze e 1RM stimato sono grandezze *di livello*: partono dal minimo, e
allora il grafico **dichiara la scala** nel piede. Le barre del volume partono sempre da
zero, perché l'area è il canale percettivo e una barra tagliata mente (`chart-domain.ts`).

**`nameKey` include l'attrezzo.** Con ~270 voci generate per combinazione movimento ×
attrezzo, il nome da solo non è più un'identità: senza l'attrezzo nella chiave, il seed
perderebbe voci sull'indice unico.

**Il seed riconosce le voci per `family` + `variant` + `equipment`, mai per nome.** È
quello che gli permette di *aggiornare* gli 81 esercizi della v1 invece di affiancarne
una copia: lo storico dell'utente resta attaccato all'esercizio che ha sempre usato. E
gli esercizi `isCustom` non li tocca mai, nemmeno per aggiungere un campo.

**Il Trainer scrive la decisione, non la ricalcola.** Ogni cambio di carico produce una
riga in `trainerDecisions` con la regola che l'ha prodotta, i numeri su cui si basa e le
sessioni che li contengono. È lo stesso motivo per cui `PersonalRecord` è una tabella e
non un calcolo: la storia deve restare quella che è stata, anche dopo che cambi
un'impostazione o cancelli un allenamento. Un «perché» ricalcolato a ogni render
cambierebbe da solo, e un allenatore che cambia versione smette di essere credibile.

**Il programma non scavalca da solo una settimana vuota.** Se una settimana passa senza
un allenamento, il Trainer si ferma e chiede: ripetere la settimana, andare avanti o
rigenerare — tre azioni, nessuna preselezionata, e la frase «Non tocco niente finché non
decidi». Dalla seconda settimana saltata di fila propone anche di **ridurre i giorni**:
adattare, non insistere.

**Il carico consigliato entra nei campi come valore, non come placeholder.** Il Trainer
propone, quindi scrive. Una proposta che l'utente deve ridigitare non è una proposta.

**Il formato di backup è salito a 2, e nello stesso momento l'importatore ha imparato a
leggere l'1.** Un backup fatto ieri deve restare importabile domani: è l'unica rete di
sicurezza di quest'app.

---

## Fuori scope, di proposito

Niente account, niente sincronizzazione, niente condivisione o feed sociale, niente
telemetria, niente notifiche push, niente libbre come unità predefinita, niente
importazione "unisci" (l'import sostituisce). Sono scelte della specifica, non cose
rimaste indietro.
