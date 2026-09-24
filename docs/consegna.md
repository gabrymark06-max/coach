# Lifted — stato del progetto e cosa resta da fare

Aggiornato: 2026-09-24. Per chi riprende il lavoro (umano o agente).

## Che cos'è

Clone personale di **Hevy**, **local-first**: Next.js 16 (App Router, TypeScript, Tailwind,
shadcn/Radix, lucide, Recharts) con **tutti i dati in IndexedDB via Dexie**. Nessun backend,
nessun account, nessuna API, nessun costo. PWA installabile e **funzionante offline**.
Tutto in italiano. Tema scuro unico.

Documenti di riferimento, in `docs/`:
- `spec.md` — specifica originale dell'utente
- `spec-v2.md` — revisione: layout Hevy **web**, Trainer, libreria completa, niente video
- `esercizi-hevy.md` — la lista esercizi fornita dall'utente (fonte del seed)
- `design-system.md` — **v2.0**, ~3150 righe: token, componenti, rotte, responsive,
  accessibilità (§8), regole di scrittura (§11), modello dati (§9), consegne (§10-bis)
- `qa-report.md` — due audit completi con riproduzioni e `file:riga`
- `rif-hevy-*.png` — screenshot di hevy.com usati come riferimento di layout

## Comandi

```
pnpm install
pnpm dev                      # sviluppo (service worker SPENTO di proposito)
pnpm build && pnpm start      # produzione su :3000 — l'offline si prova solo qui
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e                      # Playwright + Edge, 5 larghezze, axe incluso
```
Nessun `.env`, nessun servizio esterno. Per ripartire da zero: Impostazioni → Dati →
Cancella tutti i dati.

## Che cosa è fatto

Tutto quello che la specifica chiede è costruito e verificato in browser:

- **Sessione**: tipi serie Normale/W/D/F, RPE, volume in tempo reale, cronometro,
  timer di recupero (ricalcolato da `Date.now()`, sopravvive a background e reload),
  sessione minimizzabile e ripresa dopo chiusura, bozza offline con coda idempotente.
- **Routine** illimitate, editor con riordino.
- **Calcolatori**: riscaldamento a percentuali, dischi con inventario e disegno del bilanciere.
- **Libreria**: ~269 esercizi variante per variante dal file dell'utente, filtri per muscolo
  e attrezzo, esercizi personalizzati illimitati, due pannelli virtualizzati da 1280px.
- **Record personali**: 1RM stimato, volume, ripetizioni; pari merito non fa record;
  eliminando una sessione i record si ricalcolano e i badge non restano orfani.
- **Statistiche**: volume settimanale/mensile, andamento 1RM, distribuzione per gruppo
  muscolare, elenco PR. Recharts caricato con `next/dynamic`, fuori dal percorso sessione.
- **Misure corporee** con grafici per metrica.
- **Backup**: export JSON e CSV (per Excel italiano: `;`, virgola decimale, BOM), import in
  transazione con rollback; `formatVersion: 2` che accetta anche i file v1.
- **Guscio v2**: sidebar 264px da 1024, colonna destra da 1280, bottom nav a 5 tab su
  telefono, `/home` a feed, profilo con calendario mensile navigabile da tastiera,
  impostazioni a due colonne.
- **Trainer**: questionario a 6 passi, generatore di programma (16 pattern di movimento,
  split scelto dai giorni, rifiuto motivato se l'attrezzatura non basta), motore di
  progressione a **9 regole nominate**, registro delle decisioni, "riga del perché" sotto
  ogni carico e foglio "Perché questo carico".
- **PWA**: manifest, icone generate, service worker Serwist, offline completo.

**Verifiche**: 341 test unitari e ~259 end-to-end (5 larghezze), axe **0 violazioni** su 21
combinazioni rotta/stato, offline provato a cache fredda e calda.

## Storia dei commit

```
b180982  Trainer — programma generato, progressivo e trasparente
bf48358  guscio Hevy web, feed, calendario, libreria completa
016636e  record, statistiche, misure, backup, PWA
6d7010b  scaffolding, Dexie, sessione, calcolatori
fcbd0dc  si riparte da zero  (prima c'era fitcoach, ora sul ramo fitcoach-v1)
```
Repo GitHub: `gabrymark06-max/coach`, branch `main`. Il progetto precedente (fitcoach:
coach evidence-based con backend FastAPI) vive intero sul ramo `fitcoach-v1` e sul tag
`fitcoach-v1.0` — **non va cancellato**, ed è ancora online (Render + Neon + Vercel).

## Che cosa resta da fare

### 1. Lavoro non committato sul disco — verificarlo e committarlo
Ci sono ~30 file modificati e 5 nuovi che chiudono il **bloccante** del secondo audit e
buona parte dei difetti. Stato verificato il 2026-09-24:
`pnpm typecheck` pulito · `pnpm test` **341/341** · `pnpm build` exit 0 ·
`e2e/trainer-con-storico.spec.ts` **6/6 verdi** (era il repro del bloccante).
Resta da far girare la **suite e2e completa** per escludere regressioni, poi committare.

**Il bloccante era**: il Trainer non si generava per chi aveva già registrato anche un solo
allenamento — `decideProgression` andava oltre la guardia quando il carico era seminato
dallo storico ma non c'era nessuna prestazione dentro il programma
(`src/lib/trainer/rules.ts`, `src/lib/db/trainer-ops.ts`), e `trainer-view.tsx` inghiottiva
l'errore in un `catch {}` vuoto. Entrambi risolti; il `catch` vuoto non c'è più.

### 2. Difetti del secondo audit — controllare quali restano
Elenco completo con riproduzioni e `file:riga` in `docs/qa-report.md`, sezione
"Secondo audit — 2026-09-24". Dalle modifiche sul disco sembrano già affrontati split,
catena `Invio` con RPE, `h1` sulle rotte inesistenti, manifest, libreria, calendario,
questionario, import con `exercises: []`. **Da riverificare uno per uno.**

Restano comunque aperti e dichiarati:
- **LCP mobile** 3,8-4,5 s secondo Lighthouse a freddo (misura diretta CDP: 2,2-2,3 s;
  a caldo col service worker: 0,2 s). Migliorato molto ma non dentro il budget di 2,5 s.
- **Zoom 200%**: il pulsante `TERMINA` sborda di 46px.
- **"Sostituisci un esercizio"** nel menu del Trainer: deciso fuori scope.

### 3. Riverifica QA
Un audit di chiusura sul lavoro sopra. Il metodo che ha funzionato: riprodurre ogni difetto
con la sequenza originale, non fidarsi dei rapporti.

### 4. Metterla online (ultimo passo, ~5 minuti)
Serve per installarla sul telefono: una PWA non si installa da `localhost`.
Vercel, piano gratuito, uso personale. L'account dell'utente è `gabrymark06-max`, team
**`gabrielebuilds`** (l'account personale non è uno scope valido: ogni comando vuole
`--scope gabrielebuilds`). Il token va passato come variabile d'ambiente `VERCEL_TOKEN`,
mai in chiaro. **L'URL assegnato si legge dall'output, non si deduce dal nome del progetto.**

## Cose da sapere prima di toccare il codice

- **I dati sono solo sul dispositivo.** Il backup JSON è l'unica rete di sicurezza: export
  e import sono funzioni di prima classe, non un ripensamento. Su iOS, una PWA **non**
  aggiunta alla schermata Home può perdere IndexedDB dopo 7 giorni.
- **La riga della serie è il percorso critico**: si usa in palestra, col pollice, fra una
  serie e l'altra. Input non controllati, tastierino che non si chiude fra i campi,
  bersagli da 48px, niente `autoFocus` su telefono. Non "ottimizzarla" con stato React.
- **Le decisioni si scrivono, non si ricalcolano**: `PersonalRecord` e `ProgressionDecision`
  sono tabelle perché la storia deve restare quella che è stata.
- `#007AFF` non è mai colore di testo (non regge il contrasto sulle card): è il
  colore-firma. I pulsanti usano `#1268EC`. I contrasti sono misurati in §8.1 del design
  system: non cambiarli a occhio.
- Nessun hex e nessun px magico dentro i componenti: tutto passa dai token in `globals.css`.
- Niente funzioni sociali, niente video, niente emoji come icone, niente tema chiaro.
