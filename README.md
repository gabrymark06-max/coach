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
| **Esercizi** | libreria di 81 esercizi in italiano, filtri per muscolo e attrezzo, esercizi personalizzati illimitati |
| **Record personali** | rilevati da soli alla chiusura della sessione su 1RM stimato, volume e ripetizioni, con il valore precedente e la sua data («112 kg, +4 sul record») |
| **Profilo** | storico cronologico, dettaglio di ogni allenamento, riepilogo personale |
| **Statistiche** | volume settimanale e mensile, distribuzione per gruppo muscolare, andamento del 1RM stimato per esercizio, elenco dei record |
| **Misure** | peso corporeo, massa grassa e sei circonferenze, con grafico di andamento per ciascuna |
| **Backup** | export completo in JSON e CSV, ripristino da JSON in transazione |
| **PWA** | installabile su iOS e Android, **funziona completamente offline** |

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

Per ripartire da zero: **Impostazioni → Backup → Cancella tutti i dati**, oppure
cancella i dati del sito dal browser.

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
| `pnpm test` | unit test con Vitest (logica pura + strato Dexie su `fake-indexeddb`) |
| `pnpm e2e` | Playwright su Edge a 375 / 768 / 1440, con axe |
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
│   ├── (tabs)/                 le cinque tab, con bottom nav / rail laterale
│   │   ├── allenamento/        quick start, routine, editor con riordino
│   │   ├── profilo/            storico, riepilogo personale, dettaglio sessione
│   │   ├── esercizi/           libreria, filtri in query string, esercizi custom
│   │   ├── misure/             elenco metriche + dettaglio con grafico
│   │   └── statistiche/        volume, distribuzione muscolare, 1RM, record
│   ├── sessione/               sessione attiva a schermo intero + riepilogo con i PR
│   └── impostazioni/           preferenze, backup, informazioni
├── components/
│   ├── ui/                     primitivi su Radix, ritemati sui nostri token
│   ├── layout/                 bottom nav, SessionBar, live regions, avvisi §5.1
│   ├── session/                NumberField, SetRow, ExerciseCard, timer, calcolatori
│   ├── charts/                 cornice e stati dei grafici + Recharts in next/dynamic
│   ├── history/ · measures/ · settings/
│   └── shared/                 EmptyState, ErrorState, Async, PRBadge, SortableList
├── lib/
│   ├── db/                     schema, migrazioni, seed, query, mutazioni, PR, backup
│   ├── logic/                  volume, 1RM, PR, statistiche, riscaldamento, dischi, timer
│   ├── backup/                 formato versionato, CSV, download
│   ├── format.ts               Intl it-IT
│   └── hooks/                  useLiveData (tre stati), useNow, useRouteId, …
└── sw.ts                       service worker
docs/
├── spec.md                     il brief dell'utente
└── design-system.md            token, componenti, flussi, contratto di accessibilità
e2e/                            Playwright: sessione, record, backup, offline, axe
scripts/generate-icons.mjs      icone PWA generate dai token, senza dipendenze
```

---

## Dati

Tutto in IndexedDB, database `lifted`, schema v1 (`src/lib/db/migrations.ts`).

| Tabella | Chiave e indici |
|---|---|
| `exercises` | `id`, `&nameKey`, `name`, `muscleGroup`, `equipment`, `createdAt`, `[muscleGroup+equipment]`, `*secondaryMuscles` |
| `routines` | `id`, `order`, `name`, `split`, `updatedAt`, `lastPerformedAt`, `[split+order]` |
| `sessions` | `id`, `status`, `startedAt`, `routineId`, `[status+startedAt]`, `*exerciseIds` |
| `personalRecords` | `id`, `exerciseId`, `sessionId`, `achievedAt`, `[exerciseId+kind]`, `[exerciseId+achievedAt]` |
| `measurements` | `id`, `metric`, `date`, `[metric+date]` |
| `settings` | `id` (singleton) |
| `appMeta` | `key` (versione del seed) |

Le serie restano annidate dentro la sessione: la sessione è il documento, `*exerciseIds`
è solo un indice derivato per ritrovarla partendo da un esercizio.

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

---

## Fuori scope, di proposito

Niente account, niente sincronizzazione, niente condivisione o feed sociale, niente
telemetria, niente notifiche push, niente libbre come unità predefinita, niente
importazione "unisci" (l'import sostituisce). Sono scelte della specifica, non cose
rimaste indietro.
