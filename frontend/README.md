# fitcoach — frontend

Next.js 16 (App Router, Turbopack), React 19, TypeScript. Nessuna libreria UI: i token del sistema di design
(`src/styles/tokens.css`) sono le uniche misure e gli unici colori del progetto. PWA con Serwist.

Il contratto API è congelato: i tipi in `src/lib/api/schema.d.ts` sono generati da `/openapi.json` del backend.
Se il backend cambia, `pnpm types:api` + `pnpm typecheck` rompono il build, non la produzione.

## Avvio locale

Requisiti: Node 24, pnpm 11, il backend avviato su `http://127.0.0.1:8000` (vedi `../backend/README.md`).

```bash
cd frontend
pnpm install
cp .env.example .env.local      # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SITE_URL
pnpm dev                        # http://localhost:3000
```

Il backend deve avere `CORS_ORIGINS` con l'origine del frontend (default `http://localhost:3000`).

## Comandi

| Comando | Cosa |
|---|---|
| `pnpm dev` | sviluppo |
| `pnpm build` · `pnpm start` | build di produzione e server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint (config Next + React Compiler rules) |
| `pnpm test` | Vitest: formattazione, parser `[[n]]`, timer a timestamp, bozza IndexedDB, parser SSE, modifiche a parole (`describeDiff`) |
| `pnpm types:api` | rigenera i tipi dal contratto (backend acceso) |

## Struttura

```
src/
  app/                    rotte (App Router)
    (public)/             landing, prezzi, privacy, termini, crediti, accedi, registrati, password, verifica
    (app)/                oggi (+readiness, seduta, chiusa), settimana, chat, progressi, blocco/[n]/riepilogo, account
    onboarding/           5 passi + sicurezza + pronto (senza rail, nessun paywall)
    sw.ts                 service worker (Serwist): precache build + /~offline, network-first su /oggi/*
    serwist/[path]/       route che compila e serve /serwist/sw.js
    opengraph-image.tsx   OG con il logotipo senza nota; icon.tsx / apple-icon.tsx / icons/[name] per PWA
  styles/tokens.css       §1 del design system: colori, due scale (data-scale="palestra"), spazio, raggi, durate, z-index
  styles/base.css         reset, classi di testo .t-*, focus, utilità
  styles/components.css   tutti i componenti (§2), solo con i token
  components/note/        NoteMark, NotedText ([[n]] → apici), NoteSheet (mobile modale / desktop aside), StudyCard, Apparatus
  components/session/     ExerciseBlock, SetRow, RestTimer (tempo a timestamp), Prescription
  components/chat/        AiBadge, CoachMessage (blocks), Composer + quota, ChatScreen (SSE)
  components/paywall/     ProCard: tre superfici, mai in /oggi/* e /onboarding/* (garanzia per rotta)
  lib/api/                client (Bearer + refresh su 401), endpoints (una funzione per rotta), tipi generati
  lib/draft/              bozza seduta in IndexedDB (idb), coda idempotente per client_op_id, sync al ritorno online
  fonts/                  Archivo e Newsreader variabili (OFL), self-hosted via next/font/local
```

## Scelte da sapere

- **Auth**: JWT in `localStorage` (`fitcoach.auth.v1`), refresh silenzioso a 30 s dalla scadenza e su 401; le rotte app
  sono renderizzate lato client dietro `AppShell` (le pubbliche sono SSR/SSG per SEO).
- **Seduta offline**: ogni cambio scrive prima la bozza (`session_drafts`) e mette in coda l'operazione (`op_queue`),
  poi tenta `POST /sessions/{id}/sync`. Al ritorno online o in primo piano la coda si svuota. Bozze più vecchie di
  7 giorni si cancellano. Conflitto (`409 draft_conflict`) → dialogo "Quale tengo?".
- **Timer**: `end_at` salvato in IndexedDB, residuo ricalcolato da timestamp (mai contando tick); sopravvive al reload.
- **Note**: nessuna nota scritta nel frontend. Quelle di sistema (IVA, recesso, cos'è fitcoach, costanza) arrivano da
  `GET /knowledge/rules/{id}` e da `GET /chat/texts`.
- **Email di supporto**: da `GET /chat/texts.support_email` nelle pagine pubbliche (footer, `/prezzi`) e da
  `GET /me.support_email` in app. Nessuna env del client (contratto v1.1).
- **Contratto v1.1**: le opzioni del blocco di sicurezza della readiness (`safety.message_id`) e degli stati vuoti di Oggi
  (`action.message_id`) si eseguono con `POST /chat/options/{id}`; "Versione corta (25′)" in Oggi chiama
  `POST /sessions/{id}/short` e mostra le modifiche a parole come la readiness (`AdaptedSummary`).
- **PWA**: `@serwist/turbopack` (Next 16 compila con Turbopack; `@serwist/next` è la variante webpack della stessa 9.5).

## Deploy (Vercel)

Passi e verifica in [`../docs/deploy.md`](../docs/deploy.md). Variabili (Production e Preview): `NEXT_PUBLIC_API_URL` (URL
pubblico del backend), `NEXT_PUBLIC_SITE_URL` (dominio del sito, per sitemap, OG e canonical), `ENABLE_EXPERIMENTAL_COREPACK=1`
(usa `pnpm@11.7.0` da `packageManager`). Se il progetto è collegato al repo Git: Root Directory = `frontend`. Build: `pnpm build`.
Nessun segreto nel client. L'origine dell'API è cotta dentro `sw.js` al build: cambiarla richiede un nuovo deploy.
`/serwist/*` esce con `Cache-Control: public, max-age=0, must-revalidate`, così il browser rivaluta il service worker a ogni controllo.
