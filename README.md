# ClearTrial

Semantic search over ClinicalTrials.gov with LLM-parsed eligibility criteria.

## What This Does

ClinicalTrials.gov has ~568k studies. Its search is keyword-based and its eligibility criteria are buried in unstructured free text. ClearTrial fixes both:

1. **Semantic search** — vector embeddings over trial titles, descriptions, conditions, interventions, and eligibility criteria. Search in natural language.
2. **Structured eligibility** — LLM-parsed inclusion/exclusion criteria extracted into queryable fields (age, biomarkers, prior treatments, disease stage).
3. **Trial landscape dashboards** — for any condition, see active trials, phase distribution, interventions, enrollment status, geographic spread.
4. **Alerts** — subscribe to conditions or trials, get notified on status changes.

## Architecture

- **Data**: ClinicalTrials.gov API v2 (bulk ingest → PostgreSQL + pgvector)
- **Embeddings**: OpenAI `text-embedding-3-small` for semantic search
- **Eligibility parsing**: Claude API for structured extraction from free-text criteria
- **Backend**: FastAPI (Python)
- **Frontend**: Next.js
- **Search**: pgvector for similarity search + full-text search fallback

## Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
python ingest.py        # Pull data from ClinicalTrials.gov
python parse_elig.py    # Parse eligibility criteria with LLM
uvicorn app:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## License

MIT
