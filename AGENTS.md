# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

ClearTrial is a two-service app (FastAPI backend + Next.js frontend) with a shared PostgreSQL + pgvector database.

- **Backend** (Python/FastAPI, port 8000): REST API for studies, semantic search, landscape analysis, patient matching. Connects to Postgres via SQLAlchemy (sync driver `psycopg2`).
- **Frontend** (Next.js, port 3000): UI with search, filters, and analytics dashboard. Has server-side API routes (`/api/studies`, `/api/stats`) that connect to Postgres via `@neondatabase/serverless`.
- **Database**: PostgreSQL 17 + pgvector, run via `docker compose up -d db`. Credentials: `cleartrial`/`cleartrial`/`cleartrial`.

### Key development caveat

The frontend's server-side API routes use `@neondatabase/serverless`, which requires Neon's HTTP proxy infrastructure. In local development with a standard PostgreSQL instance, these routes return errors or empty data. The frontend UI still renders but shows zero counts and empty charts. The backend API at `:8000` works correctly with standard PostgreSQL and can be used for testing data-dependent features.

### Running services

See `README.md` for standard commands. Quick reference:

- **Database**: `docker compose up -d db` (must be running first)
- **Backend**: `cd backend && uvicorn app:app --reload --port 8000`
- **Frontend**: `cd frontend && npm run dev`

### Environment files

- `/workspace/.env` — backend config (loaded by `backend/config.py` from project root). Copy from `backend/.env.example`. `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are only needed for semantic search and eligibility parsing features.
- `/workspace/frontend/.env.local` — frontend config. Needs `DATABASE_URL=postgresql://cleartrial:cleartrial@localhost:5432/cleartrial`.

### Data seeding

To populate the database with sample data: `cd backend && INGEST_LIMIT=100 python ingest.py` (fetches from ClinicalTrials.gov public API). The ingest script auto-creates tables and the pgvector extension.

### Lint & type checks

- Frontend lint: `cd frontend && npm run lint`
- Frontend type check: `cd frontend && npx tsc --noEmit`
- Frontend build: `cd frontend && npm run build`
- No backend linter is configured in the repo.

### Known issues

- Backend `/api/studies?q=...` search with a query string triggers a SQLAlchemy `TypeError` on the `func.cast(Study.conditions, text("text"))` call. The endpoint works without the `q` parameter.
- Docker must be started with `fuse-overlayfs` storage driver and `iptables-legacy` in the cloud VM environment (nested container setup).
