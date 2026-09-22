# Lifted

Clone personale di Hevy, **local-first**: tutti i dati restano sul dispositivo (IndexedDB via Dexie), nessun server, nessun account, nessun costo.

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · Radix UI · lucide-react · Dexie.js

> La versione precedente di questo repo (fitcoach: coach evidence-based con backend FastAPI) vive sul ramo `fitcoach-v1` e sul tag `fitcoach-v1.0`.

---

## Avvio locale

Serve Node 24 e pnpm 11.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Niente `.env`: l'app non parla con nessun servizio esterno e non ha segreti. Al primo
avvio crea il database IndexedDB `lifted`, ci scrive le impostazioni di default e vi
carica la libreria di 81 esercizi. Per ripartire da zero basta cancellare i dati del
sito dal browser.

### Comandi

| Comando | Cosa fa |
|---|---|
| `pnpm dev` | sviluppo |
| `pnpm build` · `pnpm start` | build di produzione e server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (config Next + regole React) |
| `pnpm test` | unit test con Vitest (logica pura + strato Dexie su `fake-indexeddb`) |
| `pnpm e2e` | Playwright su Edge a 375 / 768 / 1440, con axe |
| `pnpm e2e:375` | solo il telefono |

`pnpm e2e` costruisce nulla da sé: prima serve `pnpm build`, poi Playwright avvia
`next start` sulla porta 3100.

---

## Struttura

```
src/
├── app/
│   ├── layout.tsx              lang="it", font, theme-color, regioni aria-live
│   ├── globals.css             TUTTI i token del design system + @theme inline
│   ├── (tabs)/                 le cinque tab, con bottom nav / rail laterale
│   │   ├── allenamento/        quick start, routine, editor routine
│   │   ├── esercizi/           libreria, filtri in query string, esercizi custom
│   │   └── profilo · misure · statistiche   stato vuoto onesto (secondo intervento)
│   └── sessione/               sessione attiva a schermo intero + riepilogo
├── components/
│   ├── ui/                     primitivi su Radix, ritemati sui nostri token
│   ├── layout/                 bottom nav, SessionBar, live regions, toaster
│   ├── session/                NumberField, SetRow, ExerciseCard, timer, calcolatori
│   ├── exercises/ · routine/   liste, filtri, form
│   └── shared/                 EmptyState, ErrorState, Async (i tre stati)
└── lib/
    ├── db/                     schema, migrazioni, seed, query, mutazioni, session-ops
    ├── logic/                  volume, 1RM, riscaldamento, dischi, timer (puro, testato)
    ├── format.ts               Intl it-IT
    └── hooks/                  useLiveData (tre stati), useNow, useReducedMotion
docs/
├── spec.md                     il brief dell'utente
└── design-system.md            token, componenti, flussi, contratto di accessibilità
e2e/                            Playwright: flusso di sessione, responsive, axe
```

---

## Dati

Tutto sta in IndexedDB, database `lifted`, schema v1 (`src/lib/db/migrations.ts`).

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

**Il backup non esiste ancora.** Finché non arriva l'export del secondo intervento, i
dati vivono solo in questo browser e cancellare i dati del sito li perde.

---

## Stato

Primo di due interventi di build. **Fatto:**

- scaffolding, token, tipografia, navigazione, i tre stati su ogni lettura;
- strato Dexie completo (tutte le entità del modello, anche quelle che servono dopo);
- libreria di 81 esercizi in italiano, seed idempotente;
- tab Allenamento: quick start, routine illimitate, editor con serie di riferimento e riordino;
- sessione attiva: `SetRow` con peso/reps/RPE, tipi serie W/D/F, volume in tempo reale,
  cronometro, timer di recupero fluttuante con avviso sonoro, minimizzazione con
  `SessionBar`, ripresa dopo chiusura, dialog oltre le 6 ore, chiusura con riepilogo;
- calcolatore di riscaldamento e calcolatore di dischi, deep-linkabili da query param;
- tab Esercizi: ricerca, filtri per muscolo e attrezzo, esercizi personalizzati, dettaglio.

**Secondo intervento:** Profilo/Feed e storico, Statistiche con grafici (Recharts),
Misure, rilevamento automatico dei PR, export/import JSON e CSV, PWA installabile e
offline. Le tabelle `personalRecords`, `measurements` e `settings` esistono già.
