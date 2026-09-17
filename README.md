# fitcoach

Una scheda che dice *perché*: piano di allenamento generato da un motore deterministico con regole citate (DOI verificati
su Crossref), seduta che funziona anche offline in palestra, e un coach AI che propone modifiche che il motore valida e
l'utente conferma. Free: il primo blocco di 4 settimane completo. Pro: 9,99 €/mese o 59,99 €/anno, IVA inclusa.

Stato: build completo, QA **pronto con riserve** (`docs/qa-report.md`), deploy **preparato** (`docs/deploy.md`).

## Struttura

```
backend/     FastAPI, SQLAlchemy async + asyncpg, Alembic, pgvector — README con avvio e struttura
frontend/    Next.js 16 (App Router), PWA Serwist, seduta offline in IndexedDB — README con avvio e struttura
docs/        allineamento → competitors → brief → verifica → business-model → direzione-visiva → design-system
             → api-contract (congelato) → qa-report → deploy
render.yaml  blueprint Render per l'API (rootDir backend)
```

## Avvio locale

Servono Python 3.12 + [`uv`](https://docs.astral.sh/uv/), Node 24 + pnpm 11. Nessun Postgres da installare: in dev e
test il backend avvia un Postgres embedded con pgvector.

```powershell
# 1) backend — http://127.0.0.1:8000 (Swagger su /docs, contratto su /openapi.json)
cd backend
uv venv .venv --python 3.12
uv sync --python .venv\Scripts\python.exe
Copy-Item .env.example .env                       # imposta CROSSREF_MAILTO
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe -m scripts.seed          # verifica i 22 DOI su Crossref: serve la rete
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2) frontend — http://localhost:3000
cd ..\frontend
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Senza chiavi: LLM `fake` (deterministico), Stripe spento (503 onesto su checkout/portal/webhook), email `fake`.

## Test

```powershell
cd backend;  .venv\Scripts\python.exe -m pytest -q          # 164 test, Postgres embedded temporaneo
cd frontend; pnpm typecheck; pnpm lint; pnpm test; pnpm build   # 56 test
```

## Deploy

Render (API, free, Frankfurt) + Neon (Postgres con pgvector, free) + Vercel (frontend, Hobby): 0 €/mese per il test.
Passi in ordine, lista di cosa serve, variabili d'ambiente, monitoring e rollback: **[`docs/deploy.md`](docs/deploy.md)**.

## Segreti

Mai nel repo. `backend/.env` e `frontend/.env.local` sono ignorati; i `.env.example` hanno solo nomi e descrizioni.
In produzione i valori vivono nelle env di Render e Vercel.
