# fitcoach — deploy

Stato (2026-09-18): **online.** Frontend, API e database sono in produzione.

| Pezzo | URL | Stato |
|---|---|---|
| Frontend | **https://fitcoach-three-xi.vercel.app** | online, pubblico |
| API | https://fitcoach-api-208b.onrender.com | online (`/health`, `/health/db` 200) |
| Database | Neon, Frankfurt | schema `715319c182ff head`, seed fatto |

**Resta un passo a mano dell'utente:** su Render, `CORS_ORIGINS` e `FRONTEND_URL` vanno messi all'URL Vercel
reale (`https://fitcoach-three-xi.vercel.app`). Finché non è fatto, il browser blocca ogni chiamata all'API dal
sito: vedi §3.6. Il backend funziona (verificato end-to-end, §7bis), manca solo l'intestazione CORS per quell'origine.

Decisioni dell'utente già prese: online subito **senza chiavi** (LLM `fake`, Stripe spento → 503 onesto, email
`fake`), sottodomini gratuiti, per ora è un test.

---

## 0. Cosa serve dall'utente (in quest'ordine)

| # | Cosa | Dove | Note |
|---|---|---|---|
| 1 | **Repo GitHub** per `fitcoach/` (privato va bene) | `gh` è già autenticato come `gabrymark06-max`: basta `gh repo create fitcoach --private --source . --push` dalla cartella `fitcoach/` | Render fa deploy **solo da un repo Git** (niente upload da CLI). Vercel può anche fare upload da CLI, ma con il repo collegato si ottiene il deploy a ogni push. |
| 2 | **Account Neon** (database) | https://console.neon.tech → Sign up (GitHub va bene) → *New project*: nome `fitcoach`, regione **Europe (Frankfurt)**, Postgres 17+ | Piano Free: 0,5 GB, 100 CU-ore/mese, pgvector 0.8, scale-to-zero dopo 5 min (verifica #24). Serve la **connection string diretta** (non "pooled": il pooler PgBouncer in transaction mode non regge i prepared statement di asyncpg). |
| 3 | **Account Render** (API) | https://dashboard.render.com → Sign up con GitHub → autorizza l'accesso al repo `fitcoach` | Piano Free: si spegne dopo 15 min senza traffico e riparte in ~1 min; 750 ore/mese; niente shell, niente pre-deploy command, rollback solo agli ultimi 2 deploy. |
| 4 | ~~**Token Vercel**~~ **fatto** (token valido, usato per il deploy del 18/09) | https://vercel.com/account/tokens → *Create* → nome `fitcoach-cli`, scope **Full Account**, scadenza a scelta | Va passato come variabile d'ambiente `VERCEL_TOKEN`, mai come `--token` in riga di comando. |
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
  produzione")`; con il `JWT_SECRET` di sviluppo → `RuntimeError("JWT_SECRET di sviluppo non ammesso in produzione")`;
  con `CORS_ORIGINS` vuota (o che si svuota normalizzando) → `RuntimeError("CORS_ORIGINS obbligatoria in produzione...")`.
  Verificato con la prova locale (§7).
- **`DATABASE_URL` con `?sslmode=require&channel_binding=require`** (come la dà Neon) ora funziona: `app/db.py`
  traduce `sslmode` → `ssl` e scarta `channel_binding`; prima asyncpg faceva `TypeError` ancora prima di connettersi.
- **`CORS_ORIGINS`** come variabile d'ambiente vera è `https://a,https://b` (virgole, niente JSON).
  Prima della correzione (`NoDecode` in `config.py`) il processo non partiva: emerso solo nella prova da prod.
  **Lo slash finale ora è tollerato** (2026-09-18): ogni voce viene ridotta all'origine canonica
  `schema://host[:porta]` in minuscolo — `https://a.app/`, `https://A.App` e `https://a.app/path` diventano tutte
  `https://a.app`, e la voce corretta finisce nei log (`cors_origin_normalizzata`). Il browser manda `Origin`
  senza slash: prima della correzione un valore con slash faceva tornare **400 "Disallowed CORS origin"** a ogni
  preflight. In prod una lista vuota dopo la normalizzazione è un fail-fast all'avvio.
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

### 3.4 API su Render (Blueprint) — **fatto**, URL reale `https://fitcoach-api-208b.onrender.com`

1. Dashboard Render → *New* → **Blueprint** → scegli il repo `fitcoach` → Render legge `render.yaml` alla radice.
2. Ti chiede i valori con `sync: false`:
   - `DATABASE_URL` = la stringa Neon diretta (segreto)
   - `FRONTEND_URL` = `https://fitcoach-three-xi.vercel.app` (**oggi contiene ancora un valore sbagliato**: 3.6)
   - `CORS_ORIGINS` = `https://fitcoach-three-xi.vercel.app` (**oggi contiene ancora un valore sbagliato**: 3.6)
   - `SUPPORT_EMAIL`, `CROSSREF_MAILTO` = le tue email
   - `JWT_SECRET` lo genera Render (`generateValue: true`, 256 bit).
3. *Apply*. Il primo deploy: `pip install -U uv && uv sync --frozen --no-dev`, poi `alembic upgrade head` e `uvicorn`.
4. URL reale assegnato: **`https://fitcoach-api-208b.onrender.com`** — Render ha aggiunto il suffisso `-208b`.
   Non si deduce: si legge dalla dashboard (lezione di `pronostici-sigma.vercel.app`, ripetuta poi da Vercel al 3.5).
5. Prove (da PowerShell, da un URL pubblico):

```powershell
curl.exe -s https://fitcoach-api-208b.onrender.com/health          # {"status":"ok","version":"1.0.0"}
curl.exe -s https://fitcoach-api-208b.onrender.com/health/db       # {"status":"ok","version":"1.0.0","db":"ok"}
curl.exe -s https://fitcoach-api-208b.onrender.com/billing/prices  # il listino (9,99 / 59,99 / 49,99)
curl.exe -s https://fitcoach-api-208b.onrender.com/knowledge/rules/system.vat   # una nota (prova che il seed c'è)
curl.exe -s -X POST https://fitcoach-api-208b.onrender.com/billing/checkout     # 401 (non 500): l'API è viva; Stripe spento dà 503 solo da loggati
```

### 3.5 Frontend su Vercel — **fatto** (18/09/2026)

Comandi realmente eseguiti (token solo come variabile d'ambiente, mai `--token`):

```powershell
$env:VERCEL_TOKEN = "<token>"
cd C:\Users\Admin\Desktop\progetti\fitcoach\frontend
vercel whoami                                              # gabrymark06-max
vercel link --project fitcoach --scope gabrielebuilds --yes
vercel deploy --prod --scope gabrielebuilds --yes
```

**Due sorprese, entrambe da ricordare.**

1. **Lo scope personale non esiste più.** `vercel link --scope gabrymark06-max` fallisce con
   `Error: You cannot set your Personal Account as the scope.` Il progetto vive nel team **`gabrielebuilds`**
   (`team_gLyMhLA6y5YcprD10H4kWFox`). Ogni comando vuole `--scope gabrielebuilds`.

2. **Il dominio di produzione NON e `fitcoach.vercel.app`.** Il nome del progetto è `fitcoach`, ma Vercel ha
   assegnato il dominio **`fitcoach-three-xi.vercel.app`**. È esattamente la lezione di `pronostici-sigma`:
   il dominio si **legge**, non si deduce dal nome del progetto. Letto con:

```powershell
curl.exe -s -H "Authorization: Bearer $env:VERCEL_TOKEN" `
  "https://api.vercel.com/v9/projects/fitcoach/domains?teamId=team_gLyMhLA6y5YcprD10H4kWFox"
# -> {"domains":[{"name":"fitcoach-three-xi.vercel.app", ... ,"verified":true}]}
```

**Alias e protezione.** Il deploy di produzione ha due alias, ma **solo uno è pubblico**:

| URL | Chi ci arriva |
|---|---|
| `https://fitcoach-three-xi.vercel.app` | **pubblico** — è l'URL del prodotto |
| `https://fitcoach-gabrielebuilds.vercel.app` | 302 → SSO Vercel (Deployment Protection) |
| `https://fitcoach-<hash>-gabrielebuilds.vercel.app` (ogni deploy) | 302 → SSO Vercel |

Conseguenza pratica: **le preview non sono verificabili da un browser anonimo** (servono le credenziali Vercel),
e in `CORS_ORIGINS` basta la sola origine pubblica. La verifica §3.7 è stata quindi fatta **direttamente sulla
produzione**, che è anche ciò che conta.

Nota: il **primo** deploy di un progetto nuovo viene promosso a produzione da solo
(`"hint": "This is the project's first deployment, so it was assigned to production"`): non serve `--prod` per
il primo, serve per tutti quelli dopo.

**Root Directory** nel progetto Vercel è `.` perché il deploy parte da dentro `frontend/` via CLI. Se un giorno
si collega il repo GitHub al progetto, va messa a **`frontend`** (Settings → Build and Deployment), altrimenti
Vercel costruisce dalla radice e non trova il `package.json`.

Env impostate (production **e** preview, 6 voci in tutto):

```powershell
printf 'https://fitcoach-api-208b.onrender.com' | vercel env add NEXT_PUBLIC_API_URL production --scope gabrielebuilds
printf 'https://fitcoach-three-xi.vercel.app'   | vercel env add NEXT_PUBLIC_SITE_URL production --scope gabrielebuilds
printf '1' | vercel env add ENABLE_EXPERIMENTAL_COREPACK production --scope gabrielebuilds
# ...e le stesse tre per `preview`
```

La CLI 59 le crea di tipo **Sensitive**: funzionano nel build ma non si rileggono da dashboard né da CLI. Che
siano giuste lo prova l'output costruito (sitemap col dominio giusto, origine API dentro `sw.js`): vedi §3.7.

Corepack ha funzionato: nei log di build
`Detected ENABLE_EXPERIMENTAL_COREPACK=1 and "pnpm@11.7.0" in package.json` -> `Done in 14.4s using pnpm v11.7.0`.

### 3.6 Chiudere il cerchio: CORS e URL veri — **da fare a mano dall'utente**

Il backend normalizza le origini (commit `ef624cf`), quindi lo slash finale non è un problema; il **valore** però
è di un dominio che non è il nostro. Su Render l'allowlist contiene `https://fitcoach.vercel.app/`, mentre il sito
vive su `https://fitcoach-three-xi.vercel.app`.

Prova del problema, dall'origine reale:

```
curl.exe -s -I -X OPTIONS -H "Origin: https://fitcoach-three-xi.vercel.app" \
  -H "Access-Control-Request-Method: GET" https://fitcoach-api-208b.onrender.com/billing/prices
HTTP/1.1 400 Bad Request          <- nessun access-control-allow-origin

# la stessa prova con l'origine configurata oggi:
  -H "Origin: https://fitcoach.vercel.app"   -> HTTP/1.1 200 OK
                                                access-control-allow-origin: https://fitcoach.vercel.app
```

E in browser, su `/prezzi`:

```
Access to fetch at 'https://fitcoach-api-208b.onrender.com/chat/texts'
from origin 'https://fitcoach-three-xi.vercel.app' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Cosa deve fare l'utente** (serve la dashboard: non esiste API key Render).
Dashboard Render → `fitcoach-api` -> *Environment* → *Edit*, due valori, poi *Save* (Render riavvia da solo):

| Nome | Valore esatto da incollare |
|---|---|
| `CORS_ORIGINS` | `https://fitcoach-three-xi.vercel.app` |
| `FRONTEND_URL` | `https://fitcoach-three-xi.vercel.app` |

Una sola origine, senza slash finale, senza virgole: gli altri alias Vercel sono dietro SSO e non servono.
Riprova dopo il riavvio: il preflight qui sopra deve dare **200** con
`access-control-allow-origin: https://fitcoach-three-xi.vercel.app`.

### 3.7 Verifica sulla produzione (output reale, 18/09/2026)

Fatta su `https://fitcoach-three-xi.vercel.app` con Playwright + Edge (`channel: "msedge"`) e `curl.exe`.

- [x] **Home 200**, HTTPS valido (`ssl_verify_result=0`), titolo `fitcoach — una scheda che dice perché`
- [x] **Font self-hosted**: `font-family` calcolata dell'`h1` = `archivo, "archivo Fallback", ...` — Archivo, non Arial
- [x] **Header di sicurezza**: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`,
      `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- [x] **`/sitemap.xml`** e **`/robots.txt`** col dominio giusto (`https://fitcoach-three-xi.vercel.app/...`):
      prova che `NEXT_PUBLIC_SITE_URL` è stata iniettata pulita. `robots.txt` fa `Disallow` su
      `/oggi /settimana /chat /progressi /account /onboarding /blocco /accedi /registrati /serwist`
- [x] **`/manifest.webmanifest`** 200 `application/manifest+json`; **`/opengraph-image`** 200 `image/png`
- [x] **`/serwist/sw.js`** 200, `Cache-Control: public, max-age=0, must-revalidate`, `Service-Worker-Allowed: /`,
      e l'origine dell'API è cotta dentro il file. In browser il SW risulta **`activated`** su scope `/`
- [x] **`/prezzi`** rende il listino (9,99 EUR / 59,99 EUR) e la tabella Base/Pro: il fetch **lato server** verso
      Render funziona (SSR non passa dal CORS)
- [ ] **Le chiamate lato client falliscono**: `GET /billing/prices` e `GET /chat/texts` -> `net::ERR_FAILED`,
      bloccate dal CORS. **Si sbloccano col §3.6**, non è un difetto del frontend
- [x] **Errore provocato**: `GET /sessions/00000000-...` con token valido -> **404**
      `{"code":"not_found","detail":"Non trovo quello che cerchi."}` con `X-Request-Id: 8c0ddd1406364572`
- [x] **CORS da un'origine estranea**: `Origin: https://altro.example` -> **400**, nessun `access-control-allow-origin`

#### 7bis — il flusso primario, provato contro l'API di produzione

Fatto da Node (che non applica il CORS) per isolare il problema del §3.6: se il flusso passa qui, allora in
browser mancherà **solo** l'intestazione CORS. Output reale:

```
1. registrazione       -> 201
2. onboarding          -> 201 seduta: 6fa662cf-67e9-490a-8d5d-952a40687887
3. seduta              -> 200 | serie: 3
4.1 logga serie 1      -> 200
4.2 logga serie 2      -> 200
5. quota chat (prima)  -> 200 {"used":0,"limit":15,"exhausted":false}
6. chat (LLM fake)     -> 200 risposta in streaming SSE: "Ci sono. Dimmi ..."
7. quota chat (dopo)   -> 200 {"used":1,"limit":15}          <- il contatore 15 -> 14 funziona
8. checkout            -> 503 {"code":"billing_unavailable",
                               "detail":"I pagamenti non sono ancora attivi. Se ti serve Pro adesso scrivimi a ..."}
```

Registrazione, onboarding, seduta, logging delle serie, chat col provider `fake` e il 503 onesto di Stripe:
il backend in produzione fa tutto. Il contratto è stato letto da `/openapi.json`, non indovinato
(`SetPatchIn` vuole `client_op_id` + `client_updated_at`; la chat è `POST /chat/messages` con `text` +
`client_op_id`; `CheckoutIn.price` ∈ `month\|year\|year_founders`).

### 3.8 Production — **fatto**

```powershell
vercel deploy --prod --scope gabrielebuilds --yes
```

Deploy di produzione corrente: `dpl_BCHCabS4tH181Eec3hM9NnwGDTAK`
(`https://fitcoach-rytco67bg-gabrielebuilds.vercel.app`), alias `https://fitcoach-three-xi.vercel.app`.
Il precedente (`dpl_CoQgfmL8a1Bcsoek1gGzk6ihWcc3`) resta in elenco come bersaglio di rollback.

Non c'e nessuna preview da togliere da `CORS_ORIGINS`: l'allowlist deve contenere **solo**
`https://fitcoach-three-xi.vercel.app` (3.6).

---

## 4. Variabili d'ambiente (nomi, mai valori)

### Render — `fitcoach-api`

| Nome | Segreto | Da dove | Note |
|---|---|---|---|
| `DATABASE_URL` | **sì** | Neon, connessione diretta | `?sslmode=require&channel_binding=require` va bene |
| `JWT_SECRET` | **sì** | generato da Render | ruotarlo invalida tutte le sessioni |
| `APP_ENV` | no | `render.yaml` | `prod` → fail-fast attivo |
| `CORS_ORIGINS` | no | a mano | virgole, niente JSON; lo slash finale e le maiuscole vengono normalizzati |
| `FRONTEND_URL` | no | a mano | link nelle email e nei ritorni da Stripe |
| `SUPPORT_EMAIL` | no | a mano | mostrata agli utenti |
| `CROSSREF_MAILTO` | no | a mano | letta da Settings; usata dal seed |
| `TIMEZONE` | no | `render.yaml` | `Europe/Rome` |
| `LLM_PROVIDER`, `EMBEDDING_PROVIDER`, `EMAIL_PROVIDER` | no | `render.yaml` | `fake` finché non ci sono chiavi |
| `RATE_LIMIT_ENABLED`, `MISSED_SESSION_JOB_ENABLED` | no | `render.yaml` | `true` |
| `PYTHON_VERSION` | no | `render.yaml` | `3.12.14` |
| *(vuote, apposta)* `STRIPE_*`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY` | sì | — | vedi §9 |

### Vercel — progetto frontend (Production e Preview)

Progetto: **`gabrielebuilds/fitcoach`** (`prj_FGIvoTcuq5cvWls93GYYBvY0x7S6`), team
`team_gLyMhLA6y5YcprD10H4kWFox`. Tutte e tre sono impostate su **Production e Preview** (6 voci).

| Nome | Segreto | Valore | Impostata |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | no | `https://fitcoach-api-208b.onrender.com` | sì, prod + preview |
| `NEXT_PUBLIC_SITE_URL` | no | `https://fitcoach-three-xi.vercel.app` | sì, prod + preview |
| `ENABLE_EXPERIMENTAL_COREPACK` | no | `1` | sì, prod + preview |

La CLI 59 le marca `Sensitive`, quindi il valore non si rilegge: per cambiarne uno si fa
`vercel env rm <NOME> <ambiente> --scope gabrielebuilds -y` e lo si riaggiunge. `VERCEL_OIDC_TOKEN` finisce
in `frontend/.env.local` quando si fa `vercel link`: è locale, ed è ignorato da git.

Nessun segreto nel client. Locale: `backend/.env` e `frontend/.env.local` sono ignorati da git; i `.env.example`
hanno solo nomi. Controllo fatto sull'indice: `git grep` su `sk_live_|sk_test_|whsec_|sk-ant-|re_|vca_|AKIA|PRIVATE KEY` → vuoto.

---

## 5. Monitoring (minimo, gratuito)

| Cosa | Dove |
|---|---|
| Log API (JSON strutturato: `request`, `unhandled_error` con `request_id`, `startup`, `stripe_disabled`) | Render → servizio → **Logs**; filtro `unhandled_error` |
| Health | Render batte `GET /health` (liveness, senza DB). `GET /health/db` fa `SELECT 1`: usalo a mano o con un monitor **a bassa frequenza** (ogni 10–15 min), altrimenti tiene sveglio il compute Neon e brucia le 100 CU-ore |
| Tenere sveglio Render (opzionale) | cron-job.org (già in uso per jarvis) → `GET https://fitcoach-api-208b.onrender.com/health` ogni 10 min. Costa ore free (720/750 al mese) ma toglie il minuto di attesa; se non ci sono utenti, non serve |
| Log frontend (funzioni SSR: `/prezzi`, `/verifica`, `/password/reset`) | Vercel → progetto → **Logs** / **Observability** |
| DB | Neon console → *Monitoring* (connessioni, storage, CU-ore usate) |
| Un errore provocato compare? | test al 3.7: il 404 con `X-Request-Id` è nella riga `request` di Render |
| Dopo | Sentry (SDK FastAPI + Next) quando ci sono utenti: oggi sarebbe rumore senza destinatario |

---

## 6. Rollback (in due minuti)

**Frontend (Vercel)** — istantaneo, alias spostato sul deploy precedente. Serve **sempre** `--scope`:
```powershell
$env:VERCEL_TOKEN = "<token>"
cd C:\Users\Admin\Desktop\progetti\fitcoach\frontend
vercel ls --scope gabrielebuilds           # elenca i deploy con URL
vercel rollback --scope gabrielebuilds     # torna al deploy di produzione precedente
vercel rollback https://fitcoach-kcu589hfl-gabrielebuilds.vercel.app --scope gabrielebuilds   # mirato
```
Oggi il bersaglio del rollback è `dpl_CoQgfmL8a1Bcsoek1gGzk6ihWcc3`
(`https://fitcoach-kcu589hfl-gabrielebuilds.vercel.app`).

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
   `https://fitcoach-api-208b.onrender.com/billing/webhook` con `STRIPE_WEBHOOK_SECRET` (la firma è verificata nel codice: senza chiavi il
   webhook risponde 503, con la chiave ma firma sbagliata 400 `invalid_signature`; in nessun caso tocca il DB). Poi la transazione di prova e il recesso a 14 giorni fino al rimborso.
5. **LLM**: `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (o `openai` con endpoint UE), `EMBEDDING_PROVIDER=openai`
   e **rilancio del seed** (gli embedding del corpus cambiano provider).
6. **Email**: `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + dominio verificato in Resend (regione Irlanda, verifica #28).
   Render free blocca le porte SMTP, ma Resend è HTTP: ok.
7. **Dominio**: su Vercel (*Domains* → CNAME) e poi `NEXT_PUBLIC_SITE_URL`, `FRONTEND_URL`, `CORS_ORIGINS` con il
   dominio nuovo; l'API può restare su `onrender.com` o avere `api.<dominio>` (Render → *Custom Domains*).
8. **Sentry** su entrambi i lati.
