"""FastAPI backend for ClearTrial."""

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text, func, case, cast, Integer
from sqlalchemy.orm import Session
from openai import OpenAI

from config import DATABASE_URL_SYNC, OPENAI_API_KEY, EMBEDDING_MODEL
from models import Study


engine = create_engine(DATABASE_URL_SYNC)
oai = OpenAI(api_key=OPENAI_API_KEY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="ClearTrial", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Schemas ---

class StudyResult(BaseModel):
    nct_id: str
    brief_title: str | None
    overall_status: str | None
    phase: str | None
    study_type: str | None
    conditions: list | None
    interventions: list | None
    lead_sponsor: str | None
    enrollment_count: int | None
    start_date: str | None
    locations_summary: str | None
    eligibility_summary: str | None
    similarity: float | None = None

    class Config:
        from_attributes = True


class SearchRequest(BaseModel):
    query: str
    status: Optional[list[str]] = None  # filter by status
    phase: Optional[list[str]] = None
    study_type: Optional[str] = None
    conditions: Optional[list[str]] = None
    location_country: Optional[str] = None
    limit: int = 20


class LandscapeResult(BaseModel):
    total_studies: int
    by_status: dict
    by_phase: dict
    by_sponsor_class: dict
    top_interventions: list
    top_sponsors: list
    enrollment_stats: dict


# --- Helpers ---

def get_embedding(text: str) -> list[float]:
    resp = oai.embeddings.create(model=EMBEDDING_MODEL, input=[text])
    return resp.data[0].embedding


def study_to_result(row, similarity=None) -> dict:
    study = row if isinstance(row, Study) else row[0]
    sim = similarity if similarity is not None else (row[1] if not isinstance(row, Study) else None)
    
    # Build location summary
    locs = study.locations or []
    countries = list(set(l.get("country", "") for l in locs if l.get("country")))
    loc_summary = f"{len(locs)} sites in {', '.join(countries[:3])}" if locs else None
    
    # Eligibility summary from parsed data
    elig_summary = None
    if study.eligibility_parsed and isinstance(study.eligibility_parsed, dict):
        elig_summary = study.eligibility_parsed.get("inclusion_summary")
    
    return StudyResult(
        nct_id=study.nct_id,
        brief_title=study.brief_title,
        overall_status=study.overall_status,
        phase=study.phase,
        study_type=study.study_type,
        conditions=study.conditions,
        interventions=study.interventions,
        lead_sponsor=study.lead_sponsor,
        enrollment_count=study.enrollment_count,
        start_date=str(study.start_date) if study.start_date else None,
        locations_summary=loc_summary,
        eligibility_summary=elig_summary,
        similarity=round(1 - sim, 4) if sim is not None else None,  # cosine distance → similarity
    ).model_dump()


# --- Routes ---

@app.get("/api/health")
def health():
    with Session(engine) as session:
        count = session.query(func.count(Study.nct_id)).scalar()
    return {"status": "ok", "study_count": count}


@app.get("/api/studies")
def list_studies(
    q: Optional[str] = None,
    status: Optional[str] = None,
    phase: Optional[str] = None,
    study_type: Optional[str] = None,
    sponsor_class: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
):
    """List and filter studies (basic text search, no embeddings required)."""
    with Session(engine) as session:
        query = session.query(Study)
        
        # Text search across multiple fields
        if q:
            search_term = f"%{q}%"
            query = query.filter(
                (Study.brief_title.ilike(search_term)) |
                (Study.official_title.ilike(search_term)) |
                (Study.lead_sponsor.ilike(search_term)) |
                (func.cast(Study.conditions, text("text")).ilike(search_term)) |
                (Study.nct_id.ilike(search_term))
            )
        
        # Filters
        if status:
            query = query.filter(Study.overall_status == status)
        if phase:
            query = query.filter(Study.phase == phase)
        if study_type:
            query = query.filter(Study.study_type == study_type)
        if sponsor_class:
            query = query.filter(Study.lead_sponsor_class == sponsor_class)
        
        # Count total
        total = query.count()
        
        # Paginate
        offset = (page - 1) * limit
        studies = query.order_by(Study.last_update_date.desc().nullslast()).offset(offset).limit(limit).all()
        
        return {
            "studies": [
                {
                    "nct_id": s.nct_id,
                    "brief_title": s.brief_title,
                    "official_title": s.official_title,
                    "overall_status": s.overall_status,
                    "study_type": s.study_type,
                    "phase": s.phase,
                    "conditions": s.conditions,
                    "interventions": s.interventions,
                    "brief_summary": s.brief_summary,
                    "eligibility_criteria": s.eligibility_criteria,
                    "eligibility_sex": s.eligibility_sex,
                    "eligibility_min_age": s.eligibility_min_age,
                    "eligibility_max_age": s.eligibility_max_age,
                    "enrollment_count": s.enrollment_count,
                    "start_date": str(s.start_date) if s.start_date else None,
                    "completion_date": str(s.completion_date) if s.completion_date else None,
                    "lead_sponsor": s.lead_sponsor,
                    "lead_sponsor_class": s.lead_sponsor_class,
                    "locations": s.locations,
                }
                for s in studies
            ],
            "total": total,
            "page": page,
            "limit": limit,
        }


@app.post("/api/search")
def search(req: SearchRequest):
    """Semantic search over studies."""
    query_emb = get_embedding(req.query)
    
    with Session(engine) as session:
        q = session.query(
            Study,
            Study.embedding.cosine_distance(query_emb).label("distance")
        ).filter(Study.embedding.isnot(None))
        
        # Apply filters
        if req.status:
            q = q.filter(Study.overall_status.in_(req.status))
        if req.phase:
            q = q.filter(Study.phase.in_(req.phase))
        if req.study_type:
            q = q.filter(Study.study_type == req.study_type)
        
        q = q.order_by("distance").limit(req.limit)
        results = q.all()
        
        return {
            "results": [study_to_result(r) for r in results],
            "query": req.query,
        }


@app.get("/api/study/{nct_id}")
def get_study(nct_id: str):
    """Get full study details."""
    with Session(engine) as session:
        study = session.get(Study, nct_id)
        if not study:
            raise HTTPException(404, f"Study {nct_id} not found")
        
        return {
            "nct_id": study.nct_id,
            "brief_title": study.brief_title,
            "official_title": study.official_title,
            "overall_status": study.overall_status,
            "phase": study.phase,
            "study_type": study.study_type,
            "start_date": str(study.start_date) if study.start_date else None,
            "completion_date": str(study.completion_date) if study.completion_date else None,
            "enrollment_count": study.enrollment_count,
            "conditions": study.conditions,
            "interventions": study.interventions,
            "brief_summary": study.brief_summary,
            "detailed_description": study.detailed_description,
            "eligibility_criteria": study.eligibility_criteria,
            "eligibility_parsed": study.eligibility_parsed,
            "primary_outcomes": study.primary_outcomes,
            "secondary_outcomes": study.secondary_outcomes,
            "lead_sponsor": study.lead_sponsor,
            "lead_sponsor_class": study.lead_sponsor_class,
            "collaborators": study.collaborators,
            "locations": study.locations,
            "contacts": study.contacts,
            "officials": study.officials,
        }


@app.get("/api/landscape")
def landscape(
    condition: str = Query(..., description="Condition to analyze"),
):
    """Get landscape analysis for a condition."""
    with Session(engine) as session:
        # Find studies matching this condition (case-insensitive substring match)
        base = session.query(Study).filter(
            func.cast(Study.conditions, text("text")).ilike(f"%{condition}%")
        )
        
        total = base.count()
        if total == 0:
            raise HTTPException(404, f"No studies found for condition: {condition}")
        
        # Status breakdown
        status_counts = dict(
            base.with_entities(Study.overall_status, func.count())
            .group_by(Study.overall_status)
            .all()
        )
        
        # Phase breakdown
        phase_counts = dict(
            base.with_entities(Study.phase, func.count())
            .group_by(Study.phase)
            .all()
        )
        
        # Sponsor class breakdown
        sponsor_counts = dict(
            base.with_entities(Study.lead_sponsor_class, func.count())
            .group_by(Study.lead_sponsor_class)
            .all()
        )
        
        # Top sponsors
        top_sponsors = (
            base.with_entities(Study.lead_sponsor, func.count().label("cnt"))
            .group_by(Study.lead_sponsor)
            .order_by(text("cnt DESC"))
            .limit(10)
            .all()
        )
        
        # Enrollment stats
        enrollment = base.with_entities(
            func.avg(Study.enrollment_count),
            func.min(Study.enrollment_count),
            func.max(Study.enrollment_count),
            func.sum(Study.enrollment_count),
        ).first()
        
        return LandscapeResult(
            total_studies=total,
            by_status=status_counts,
            by_phase=phase_counts,
            by_sponsor_class=sponsor_counts,
            top_interventions=[],  # TODO: extract from JSON
            top_sponsors=[{"name": s[0], "count": s[1]} for s in top_sponsors],
            enrollment_stats={
                "avg": round(enrollment[0]) if enrollment[0] else None,
                "min": enrollment[1],
                "max": enrollment[2],
                "total": enrollment[3],
            },
        ).model_dump()


@app.get("/api/match")
def match_patient(
    age: int = Query(...),
    sex: str = Query(..., regex="^(male|female)$"),
    condition: str = Query(...),
    country: Optional[str] = None,
    limit: int = 20,
):
    """Match a patient profile to eligible trials."""
    with Session(engine) as session:
        q = session.query(Study).filter(
            Study.overall_status.in_(["RECRUITING", "NOT_YET_RECRUITING"]),
            func.cast(Study.conditions, text("text")).ilike(f"%{condition}%"),
        )
        
        # Filter by parsed eligibility where available
        # For studies with parsed eligibility, check age and sex
        results = q.limit(limit * 3).all()  # oversample then filter
        
        matched = []
        for study in results:
            score = 1.0
            parsed = study.eligibility_parsed or {}
            
            if isinstance(parsed, dict) and "_error" not in parsed:
                # Age check
                min_age = parsed.get("min_age_years")
                max_age = parsed.get("max_age_years")
                if min_age and age < min_age:
                    continue
                if max_age and age > max_age:
                    continue
                
                # Sex check
                p_sex = parsed.get("sex", "all")
                if p_sex and p_sex != "all" and p_sex != sex:
                    continue
                
                score = 0.9  # parsed and matched
            else:
                # Fallback: check raw fields
                if study.eligibility_sex and study.eligibility_sex != "ALL":
                    if study.eligibility_sex.lower() != sex:
                        continue
                score = 0.5  # not parsed, basic match only
            
            # Location filter
            if country and study.locations:
                if not any(l.get("country", "").lower() == country.lower() for l in study.locations):
                    continue
            
            matched.append((study, score))
            if len(matched) >= limit:
                break
        
        return {
            "patient": {"age": age, "sex": sex, "condition": condition},
            "results": [
                {**study_to_result(s), "match_score": score}
                for s, score in matched
            ],
        }
