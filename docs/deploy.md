# fitcoach — deploy

Stato: **preparato, non ancora online.** Tutto ciò che si poteva fare senza credenziali è fatto e committato; questo
documento dice, in ordine, cosa serve e cosa si esegue. Decisioni dell'utente già prese: online subito **senza chiavi**
(LLM `fake`, Stripe spento → 503 onesto, email `fake`), sottodomini gratuiti, per ora è un test.

---

## 0. Cosa serve dall'utente (in quest'ordine)

| # | Cosa | Dove | Note |
|---|---|---|---|
| 1 | **Repo GitHub** per `fitcoach/` (privato va bene) | `gh` è già autenticato come `gabrymark06-max`: basta `gh repo create fitcoach --private --source . --push` dalla cartella `fitcoach/` | Render fa deploy **solo da un repo Git** (niente upload da CLI). Vercel può anche fare upload da CLI, ma con il repo collegato si ottiene il deploy a ogni push. |
| 2 | **Account Neon** (database) | https://console.neon.tech → Sign up (GitHub va bene) → *New project*: nome `fitcoach`, regione **Europe (Frankfurt)**, Postgres 17+ | Piano Free: 0,5 GB, 100 CU-ore/mese, pgvector 0.8, scale-to-zero dopo 5 min (verifica #24). Serve la **connection string diretta** (non "pooled": il pooler PgBouncer in transaction mode non regge i prepared statement di asyncpg). |
| 3 | **Account Render** (API) | https://dashboard.render.com → Sign up con GitHub → autorizza l'accesso al repo `fitcoach` | Piano Free: si spegne dopo 15 min senza traffico e riparte in ~1 min; 750 ore/mese; niente shell, niente pre-deploy command, rollback solo agli ultimi 2 deploy. |
| 4 | **Token Vercel** nuovo (quello attuale è scaduto: `vercel whoami` → "token non valido") | https://vercel.com/account/tokens → *Create* → nome `fitcoach-cli`, scope **Full Account**, scadenza a scelta | Va passato come variabile d'ambiente `VERCEL_TOKEN`, mai come `--token` in riga di comando. |
| 5 | Un'**email di supporto** reale e una per **Crossref** | Le stesse possono coincidere | `SUPPORT_EMAIL` è mostrata agli utenti nel prodotto; `CROSSREF_MAILTO` serve al seed (polite pool). |

Non serve ora: chiavi LLM, Stripe, Resend, dominio custom. Si aggiungono dopo (§9).

---

## 1. Cosa gira dove, e perché

| Pezzo | Servizio | Piano | Costo/mese |
|---|---|---|---|
| Frontend Next.js | **Vercel** (`frontend/`) | Hobby | 0 € — **vieta l'uso commerciale**: per il test va bene, prima di vendere serve Pro (20 $/mese, business-model §10) |
| API FastAPI | **Render** web service, Frankfurt (`render.yaml`) | Free | 0 € |
| Postgres + pgvector | **Neon**, Frankfurt | Free | 0 € |
| **Totale** | | | **0 €** |

**Perché Render e non Railway.** Railway parte da 5 $/mese (Hobby, verifica #24) e pgvector non è nel template
ufficiale ("we do not plan to add extensions to the PostgreSQL templates"): serve un template community. Render ha un
piano free per il web service, la regione UE, e `render.yaml` rende l'infrastruttura un file nel repo.

**Perché Neon e non il Postgres di Render.** Il Postgres free di Render **scade dopo 30 giorni** e non ha backup
(verifica #24). Neon free non scade, ha pgvector 0.8 e una finestra di restore di 6 ore; a pagamento (Launch) arriva
a 7 giorni di PITR.

**Il prezzo dello zero.** Render free dorme dopo 15 min: la prima richiesta dopo una pausa aspetta ~1 min. Neon dorme
dopo 5 min: la prima query dopo una pausa aggiunge qualche centinaio di ms. Per un test senza utenti è accettabile;
il frontend ha i tre stati (loading / error con "Riprova") e le fetch lato server hanno un timeout di 8 s, quindi
`/prezzi` non resta appesa. Quando ci saranno utenti veri: Render Starter (7 $/mese) toglie il sonno e sblocca
pre-deploy command, shell e rollback completi.

Un deploy unico (tutto su Vercel come funzioni Python) non è adatto: il backend ha un job in-process (email di
mancata seduta), rate limiting in memoria e un lifespan con connessioni persistenti. Serve un processo lungo.

---

## 2. Vincoli letti dal codice (non opinioni)

- **1 solo worker uvicorn** (`--workers 1` in `render.yaml`): il rate limiting è `memory://` (verifica #30). Con più
  worker o repliche serve Redis.
- **Migrazioni prima del codice nuovo**: sul piano free Render non ha `preDeployCommand`, quindi `alembic upgrade head`
  è nello `startCommand`. Con 1 replica non c'è gara. Se il piano cambia, spostarlo in `preDeployCommand`.
- **`pgserver`** (Postgres embedded di dev/test) è nel gruppo `dev` di `pyproject.toml`: `uv sync --no-dev` non lo
  installa. Verificato: import dell'app in un venv senza pgserver, `APP_ENV=prod`, ok.
- **Fail-fast** in prod (`app/config.py`): senza `DATABASE_URL` → `RuntimeError("DATABASE_URL obbligatoria in
  produzione")`; con il `JWT_SECRET` di sviluppo → `RuntimeError("JWT_SECRET di sviluppo non ammesso in produzione")`.
  Verificato con la prova locale (§7).
- **`DATABASE_URL` con `?sslmode=require&channel_binding=require`** (come la dà Neon) ora funziona: `app/db.py`
  traduce `sslmode` → `ssl` e scarta `channel_binding`; prima asyncpg faceva `TypeError` ancora prima di connettersi.
- **`CORS_ORIGINS`** come variabile d'ambiente vera è `https://a,https://b` (virgole, niente JSON, niente slash finale).
  Prima della correzione (`NoDecode` in `config.py`) il processo non partiva: emerso solo nella prova da prod.
- **Il job email** gira nel processo: quando Render dorme, non gira. Con `EMAIL_PROVIDER=fake` è irrilevante oggi.
- **Il seed** (`python -m scripts.seed`, chiama Crossref) non può girare su Render free (niente shell né one-off
  job): si lancia **dal PC** contro il `DATABASE_URL` di Neon (§3.3).

---

## 3. Passi, in ordine

### 3.1 Repo su GitHub

```powershell
cd C:\Users\Admin\Desktop\progetti\fitcoach
gh repo create fitcoach --private --source . --push
```

### 3.2 Database su Neon

1. Console Neon → *New project* → `fitcoach`, **Europe (Frankfurt)**.
2. *Connect* → scegli la connessione **diretta** (deseleziona "Pooled connection") → copia la stringa:
   `postgresql://<user>:<pass>@ep-...eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`.
3. **Migrazioni prima di tutto**, dal PC (il primo deploy le rifarebbe comunque, ma così si vede subito se qualcosa non va):

```powershell
cd C:\Users\Admin\Desktop\progetti\fitcoach\backend
$env:APP_ENV = "prod"; $env:DATABASE_URL = "<stringa Neon>"; $env:JWT_SECRET = "qualunque-cosa-non-di-dev-almeno-32-caratteri"
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe -m alembic current      # deve stampare 715319c182ff (head)
```

La migrazione iniziale fa `CREATE EXTENSION IF NOT EXISTS vector`: su Neon il ruolo di default può farlo.

### 3.3 Seed della base di conoscenza (dal PC, una tantum)

```powershell
$env:CROSSREF_MAILTO = "<tua email>"
.venv\Scripts\python.exe -m scripts.seed
# atteso: "Seed completato: 22 citazioni verificate su Crossref, 43 regole, 76 esercizi, N chunk di corpus (embedding: fake)."
```

Il seed è idempotente (upsert) e fallisce in modo esplicito se un DOI non si verifica: nessun DOI non verificato entra.
Va rilanciato solo quando cambiano `rules.yaml`, `citations.yaml`, `exercises.yaml` o `corpus.yaml`.
Poi chiudi la shell (o `Remove-Item Env:DATABASE_URL`): quella stringa è un segreto.

### 3.4 API su Render (Blueprint)

1. Dashboard Render → *New* → **Blueprint** → scegli il repo `fitcoach` → Render legge `render.yaml` alla radice.
2. Ti chiede i valori con `sync: false`:
   - `DATABASE_URL` = la stringa Neon diretta (segreto)
   - `FRONTEND_URL` = `https://<progetto>.vercel.app` (lo sai al passo 3.5: metti un segnaposto e correggi dopo)
   - `CORS_ORIGINS` = idem (si aggiorna al 3.6)
   - `SUPPORT_EMAIL`, `CROSSREF_MAILTO` = le tue email
   - `JWT_SECRET` lo genera Render (`generateValue: true`, 256 bit).
3. *Apply*. Il primo deploy: `pip install -U uv && uv sync --frozen --no-dev`, poi `alembic upgrade head` e `uvicorn`.
4. Segna l'URL: `https://fitcoach-api.onrender.com` **se il nome è libero**; altrimenti Render aggiunge un suffisso.
   Non dedurlo: leggilo dalla dashboard (lezione di `pronostici-sigma.vercel.app`).
5. Prove (da PowerShell, da un URL pubblico):

```powershell
curl.exe -s https://<api>.onrender.com/health          # {"status":"ok","version":"1.0.0"}
curl.exe -s https://<api>.onrender.com/health/db       # {"status":"ok","version":"1.0.0","db":"ok"}
curl.exe -s https://<api>.onrender.com/billing/prices  # il listino (9,99 / 59,99 / 49,99)
curl.exe -s https://<api>.onrender.com/knowledge/rules/system.vat   # una nota (prova che il seed c'è)
curl.exe -s -X POST https://<api>.onrender.com/billing/checkout     # 401 (non 500): l'API è viva; Stripe spento dà 503 solo da loggati
```

### 3.5 Frontend su Vercel (preview → verifica → production)

Con il token nuovo (skill `vercel-cli-with-tokens`): la CLI 59.1.4 è installata.

```powershell
$env:VERCEL_TOKEN = "<token>"           # mai --token in riga di comando
cd C:\Users\Admin\Desktop\progetti\fitcoach\frontend
vercel whoami                            # deve stampare il tuo account
vercel link --project fitcoach --yes     # crea/collega il progetto "fitcoach"
vercel env add NEXT_PUBLIC_API_URL production    # incolla https://<api>.onrender.com
vercel env add NEXT_PUBLIC_API_URL preview
vercel env add NEXT_PUBLIC_SITE_URL production   # incolla https://<progetto>.vercel.app (vedi sotto)
vercel env add NEXT_PUBLIC_SITE_URL preview
vercel env add ENABLE_EXPERIMENTAL_COREPACK production   # valore 1: usa pnpm@11.7.0 da package.json (Vercel da solo arriva a pnpm 10)
vercel env add ENABLE_EXPERIMENTAL_COREPACK preview      # valore 1
vercel deploy --yes                      # PREVIEW: stampa un URL https://fitcoach-<hash>-<account>.vercel.app
vercel inspect <url-preview> --logs      # build verde, "(serwist) 38 precache entries"
```

Il **dominio di produzione** è `https://<progetto>.vercel.app`, dove `<progetto>` è il nome del progetto Vercel: se
`fitcoach.vercel.app` è già di qualcun altro, Vercel assegna un suffisso. Leggilo con `vercel project ls` o nella
dashboard e usa **quello** in `NEXT_PUBLIC_SITE_URL`, `FRONTEND_URL` e `CORS_ORIGINS`.

Se in seguito colleghi il repo GitHub al progetto Vercel: **Root Directory = `frontend`** (Settings → Build and
Deployment), il resto è auto-rilevato (Next.js, `pnpm build`).

### 3.6 Chiudere il cerchio: CORS e URL veri

Su Render → `fitcoach-api` → *Environment*: `CORS_ORIGINS` = `https://<progetto>.vercel.app,https://<url-preview>`
(la preview serve solo per la verifica al 3.7; poi si toglie), `FRONTEND_URL` = `https://<progetto>.vercel.app`.
Render riavvia da solo. Senza questo passo il browser dice "Senza rete" su ogni chiamata: è la causa n. 1 del
"in locale funzionava".

### 3.7 Verifica sulla preview (skill `agent-browser`, non "il deploy è passato")

- [ ] `https://<url-preview>/` carica, HTTPS valido, font self-hosted (Archivo/Newsreader) e non Arial
- [ ] `/prezzi` mostra 9,99 / 59,99 / 49,99 e "ne restano 100" (arrivano dall'API: prova che CORS passa)
- [ ] Registrazione → onboarding (5 passi + sicurezza) → `/oggi` con la prima seduta → logga 2 serie → chiudi
      (il flusso primario end-to-end contro l'API di produzione)
- [ ] Chat: 1 messaggio, risposta del provider `fake`, contatore 15 → 14
- [ ] "Passa a Pro" → alert con il detail del 503 ("I pagamenti non sono ancora attivi…"), non "Senza rete"
- [ ] `/serwist/sw.js` risponde 200, `Cache-Control: public, max-age=0, must-revalidate`, `Service-Worker-Allowed: /`;
      DevTools → Application → il SW è attivo; `/manifest.webmanifest` e le icone 192/512 caricano
- [ ] `/opengraph-image` 200 `image/png`; `/sitemap.xml` e `/robots.txt` con il dominio giusto
- [ ] Errore provocato: `GET https://<api>/sessions/non-esiste` con un token valido → 404 `not_found` con
      `X-Request-Id`, e la riga compare nei log di Render (§5)
- [ ] CORS da un'origine estranea: `curl.exe -s -I -X OPTIONS -H "Origin: https://altro.example" -H "Access-Control-Request-Method: GET" https://<api>/billing/prices` → **400**, nessun `access-control-allow-origin`

### 3.8 Production

```powershell
vercel deploy --prod --yes
```

Poi rifai i primi tre punti del 3.7 sull'URL di produzione e togli la preview da `CORS_ORIGINS`.

---

## 4. Variabili d'ambiente (nomi, mai valori)

### Render — `fitcoach-api`

| Nome | Segreto | Da dove | Note |
|---|---|---|---|
| `DATABASE_URL` | **sì** | Neon, connessione diretta | `?sslmode=require&channel_binding=require` va bene |
| `JWT_SECRET` | **sì** | generato da Render | ruotarlo invalida tutte le sessioni |
| `APP_ENV` | no | `render.yaml` | `prod` → fail-fast attivo |
| `CORS_ORIGINS` | no | a mano | virgole, niente slash finale, niente JSON |
| `FRONTEND_URL` | no | a mano | link nelle email e nei ritorni da Stripe |
| `SUPPORT_EMAIL` | no | a mano | mostrata agli utenti |
| `CROSSREF_MAILTO` | no | a mano | letta da Settings; usata dal seed |
| `TIMEZONE` | no | `render.yaml` | `Europe/Rome` |
| `LLM_PROVIDER`, `EMBEDDING_PROVIDER`, `EMAIL_PROVIDER` | no | `render.yaml` | `fake` finché non ci sono chiavi |
| `RATE_LIMIT_ENABLED`, `MISSED_SESSION_JOB_ENABLED` | no | `render.yaml` | `true` |
| `PYTHON_VERSION` | no | `render.yaml` | `3.12.14` |
| *(vuote, apposta)* `STRIPE_*`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY` | sì | — | vedi §9 |

### Vercel — progetto frontend (Production e Preview)

| Nome | Segreto | Valore |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | no | `https://<api>.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | no | `https://<progetto>.vercel.app` |
| `ENABLE_EXPERIMENTAL_COREPACK` | no | `1` |

Nessun segreto nel client. Locale: `backend/.env` e `frontend/.env.local` sono ignorati da git; i `.env.example`
hanno solo nomi. Controllo fatto sull'indice: `git grep` su `sk_live_|sk_test_|whsec_|sk-ant-|re_|vca_|AKIA|PRIVATE KEY` → vuoto.

---

## 5. Monitoring (minimo, gratuito)

| Cosa | Dove |
|---|---|
| Log API (JSON strutturato: `request`, `unhandled_error` con `request_id`, `startup`, `stripe_disabled`) | Render → servizio → **Logs**; filtro `unhandled_error` |
| Health | Render batte `GET /health` (liveness, senza DB). `GET /health/db` fa `SELECT 1`: usalo a mano o con un monitor **a bassa frequenza** (ogni 10–15 min), altrimenti tiene sveglio il compute Neon e brucia le 100 CU-ore |
| Tenere sveglio Render (opzionale) | cron-job.org (già in uso per jarvis) → `GET https://<api>/health` ogni 10 min. Costa ore free (720/750 al mese) ma toglie il minuto di attesa; se non ci sono utenti, non serve |
| Log frontend (funzioni SSR: `/prezzi`, `/verifica`, `/password/reset`) | Vercel → progetto → **Logs** / **Observability** |
| DB | Neon console → *Monitoring* (connessioni, storage, CU-ore usate) |
| Un errore provocato compare? | test al 3.7: il 404 con `X-Request-Id` è nella riga `request` di Render |
| Dopo | Sentry (SDK FastAPI + Next) quando ci sono utenti: oggi sarebbe rumore senza destinatario |

---

## 6. Rollback (in due minuti)

**Frontend (Vercel)** — istantaneo, alias spostato sul deploy precedente:
```powershell
vercel ls                                  # elenca i deploy con URL
vercel rollback                            # torna al deploy di produzione precedente
vercel rollback <url-o-id-deploy>          # oppure mirato
```

**API (Render)** — dashboard → `fitcoach-api` → *Deploys* → deploy precedente → **Rollback to this deploy**
(sul free: solo gli ultimi 2). Render ridistribuisce l'artefatto già costruito.

**Schema** — la migrazione iniziale è l'unica; le prossime vanno scritte con `downgrade()` reale e, se droppano
una colonna, in due rilasci. Rollback dello schema, dal PC contro Neon:
```powershell
.venv\Scripts\python.exe -m alembic downgrade -1
```
Regola: il codice vecchio deve funzionare con lo schema nuovo (additivo), così il rollback del codice non
richiede quello dello schema.

**Dati** — Neon free: restore a un istante nelle ultime 6 ore (*Branches* → *Restore*). Non è un backup: se
serve una copia, `pg_dump` dal PC con la stringa diretta.

---

## 7. Prove locali già fatte (2026-09-17/18, output reali)

```
# venv senza pgserver (uv sync --frozen --no-dev): pgserver installato: False · runtime ok
# A) APP_ENV=prod + DATABASE_URL finto, senza JWT_SECRET
RuntimeError: JWT_SECRET di sviluppo non ammesso in produzione
# B) APP_ENV=prod senza DATABASE_URL
RuntimeError: DATABASE_URL obbligatoria in produzione
# D) prod completo: import ok · env = prod · cors = ['https://fitcoach.vercel.app'] · llm = fake · email = fake · stripe = off
#    url risolto = postgresql+asyncpg://u:***@db.example.invalid/fitcoach?ssl=require
# E) alembic upgrade head contro host inesistente: socket.gaierror (rete, non config)
# TestClient in prod senza DB:  /health -> 200 {'status': 'ok', 'version': '1.0.0'}
#                                /health/db -> 503 {'code': 'db_unavailable', ...}
#   CORS preflight da https://fitcoach.vercel.app -> 200 allow-origin ok · da https://altro.example -> 400
# pytest -q: 164 passed
# frontend: typecheck ok · lint ok · 56 test ok · build con NEXT_PUBLIC_API_URL=https://fitcoach-api.onrender.com ok
#   (serwist) 38 precache entries · l'origine dell'API è cotta dentro sw.js · sitemap/robots con NEXT_PUBLIC_SITE_URL
# pnpm start: /serwist/sw.js → Cache-Control: public, max-age=0, must-revalidate · Service-Worker-Allowed: /
#   /prezzi con API irraggiungibile → 200 in 0,14 s (stato "loading" → la fetch client riprova)
```

---

## 8. Riserve QA che restano aperte in produzione (qa-report.md, "Terzo passaggio")

Stripe reale, LLM ed email reali, offline su iOS Safari/Android Chrome veri, screen reader reale: non cambiano con il
deploy, vanno provate quando arrivano le chiavi e un telefono. R1 e R2 sono chiuse (commit `321a38a`).

---

## 9. Dopo il test: cosa cambia per vendere

1. **Vercel Pro** (20 $/mese): Hobby vieta l'uso commerciale.
2. **Render Starter** (7 $/mese): niente sonno, pre-deploy command per le migrazioni, shell, rollback completi.
3. **Neon Launch** se servono più di 0,5 GB o PITR a 7 giorni.
4. **Stripe**: chiavi live, prezzi con `tax_behavior=inclusive`, Stripe Tax attivo, webhook su
   `https://<api>/billing/webhook` con `STRIPE_WEBHOOK_SECRET` (la firma è verificata nel codice: senza chiavi il
   webhook risponde 503, con la chiave ma firma sbagliata 400 `invalid_signature`; in nessun caso tocca il DB). Poi la transazione di prova e il recesso a 14 giorni fino al rimborso.
5. **LLM**: `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (o `openai` con endpoint UE), `EMBEDDING_PROVIDER=openai`
   e **rilancio del seed** (gli embedding del corpus cambiano provider).
6. **Email**: `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + dominio verificato in Resend (regione Irlanda, verifica #28).
   Render free blocca le porte SMTP, ma Resend è HTTP: ok.
7. **Dominio**: su Vercel (*Domains* → CNAME) e poi `NEXT_PUBLIC_SITE_URL`, `FRONTEND_URL`, `CORS_ORIGINS` con il
   dominio nuovo; l'API può restare su `onrender.com` o avere `api.<dominio>` (Render → *Custom Domains*).
8. **Sentry** su entrambi i lati.
