# fitcoach — backend

API FastAPI di fitcoach: motore di programmazione deterministico (regole con fonte), seduta con bozza offline,
coach AI mediato (l'LLM propone, il motore valida, l'utente conferma), Stripe con recesso 14 giorni.

Il contratto per il frontend è `/openapi.json` (congelato) e `../docs/api-contract.md`.

## Avvio locale (Windows, macOS, Linux)

Requisiti: Python 3.12, [`uv`](https://docs.astral.sh/uv/). **Nessun Postgres da installare**: in dev e test il
backend avvia un PostgreSQL embedded ([`pgserver`](https://pypi.org/project/pgserver/), con pgvector) nella
cartella `.pgdata`. In produzione si usa `DATABASE_URL` (Neon/Render, con estensione `vector`).

```bash
cd backend
uv venv .venv --python 3.12
uv sync --python .venv/Scripts/python.exe      # macOS/Linux: .venv/bin/python
cp .env.example .env                           # e imposta CROSSREF_MAILTO

# 1) migrazioni (mai create_all)
.venv/Scripts/python.exe -m alembic upgrade head

# 2) base di conoscenza: verifica i 22 DOI su Crossref (serve la rete) e carica regole, esercizi, corpus
.venv/Scripts/python.exe -m scripts.seed

# 3) server (1 worker: il rate limiting è in-process)
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Poi: `http://127.0.0.1:8000/docs` (Swagger) e `http://127.0.0.1:8000/openapi.json` (il contratto).

Senza chiavi LLM il provider è `fake`: deterministico, leggibile in `app/llm/fake.py`. Con `LLM_PROVIDER=anthropic`
(+ `ANTHROPIC_API_KEY`) o `LLM_PROVIDER=openai` (+ `OPENAI_API_KEY`, endpoint UE) si attivano i provider reali.

## Test

```bash
.venv/Scripts/python.exe -m pytest -q
```

I test avviano un Postgres embedded in una cartella temporanea, applicano le migrazioni Alembic vere e svuotano
le tabelle tra un test e l'altro. Stripe, LLM, embedding ed email sono doppi in memoria; il validatore DOI è
testato con un trasporto HTTP finto (e il seed reale è stato eseguito contro Crossref: vedi `docs/api-contract.md`).

## Struttura

```
app/
  main.py            app factory, CORS allowlist, rate limiting, logging strutturato, job in lifespan
  config.py          Settings da env (nessun segreto letterale)
  models.py          modello dati (SQLAlchemy 2, async)
  errors.py          un solo formato di errore: { code, detail, ...extra }
  engine/            motore puro: piano, progressione doppia su RIR, deload, versione corta, mantenimento, readiness
  knowledge/         rules.yaml (43 regole), citations.yaml (22 DOI), exercises.yaml (76), corpus.yaml, crossref.py
  llm/               interfaccia provider, fake, anthropic, openai, state card, retrieval, validatore citazioni, sicurezza
  services/          regole di dominio (onboarding, piano, seduta, oggi, chat, proposte, billing, quota, account)
  routers/           HTTP: validazione Pydantic, response_model ovunque
  jobs/              email di mancata seduta
alembic/             migrazioni
scripts/seed.py      seed con validatore DOI (fallisce senza rete: nessun DOI non verificato entra)
tests/               164 test (motore, conoscenza, auth, piano, seduta, billing, chat, account)
```

## Produzione

Il piano completo, con la lista di cosa serve e i comandi in ordine, è in [`../docs/deploy.md`](../docs/deploy.md).
In breve: **Render** (web service free, Frankfurt, `../render.yaml`) + **Neon** (Postgres con pgvector) + **Vercel** per il frontend.

- `APP_ENV=prod`, `DATABASE_URL` (Neon, connessione diretta: `?sslmode=require` viene tradotto per asyncpg), `JWT_SECRET` vero,
  `CORS_ORIGINS` con il dominio del frontend (virgole; slash finale e maiuscole vengono normalizzati, una lista vuota è un errore d'avvio). Senza `DATABASE_URL` o con il `JWT_SECRET` di dev
  il processo **non parte** (`app/config.py`).
- Un solo worker uvicorn per replica finché il rate limiting resta in memoria (verifica #30).
- `GET /health` (liveness, senza DB) per l'hosting; `GET /health/db` (`SELECT 1`) per il monitoraggio a bassa frequenza.
- Webhook Stripe su `POST /billing/webhook` con `STRIPE_WEBHOOK_SECRET`; prezzi con `tax_behavior=inclusive` e Stripe Tax attivo.
  Senza `STRIPE_SECRET_KEY` il gateway è spento: 503 `billing_unavailable`, mai 500.
- `python -m alembic upgrade head` a ogni deploy (è nello `startCommand` di Render); `python -m scripts.seed` dal PC contro il
  DB di produzione quando cambia la base di conoscenza (idempotente: upsert). `pgserver` è una dipendenza di sviluppo:
  `uv sync --no-dev` non lo installa.

## Crediti e licenze

- Istruzioni degli esercizi in italiano: [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), MIT (solo i testi;
  nessuna GIF Gymvisual). I passi usati sono in `app/knowledge/exercises_dataset_it.json`.
- Le citazioni scientifiche sono DOI verificati su Crossref; le note in italiano sono nostre e non riproducono testo integrale.
- Il questionario di sicurezza è nostro: non è il PAR-Q+ e non ne usa il testo.
