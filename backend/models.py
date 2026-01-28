"""SQLAlchemy models for ClearTrial."""

from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime, Date,
    Index, func
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase
from pgvector.sqlalchemy import Vector
from config import EMBEDDING_DIM


class Base(DeclarativeBase):
    pass


class Study(Base):
    """Core study record from ClinicalTrials.gov."""
    __tablename__ = "studies"

    nct_id = Column(String(15), primary_key=True)
    
    # Identification
    brief_title = Column(Text)
    official_title = Column(Text)
    acronym = Column(String(100))
    org_name = Column(String(500))
    org_class = Column(String(50))  # NIH, INDUSTRY, OTHER, etc.
    
    # Status
    overall_status = Column(String(50))  # RECRUITING, COMPLETED, etc.
    start_date = Column(Date)
    completion_date = Column(Date)
    last_update_date = Column(Date)
    
    # Description
    brief_summary = Column(Text)
    detailed_description = Column(Text)
    
    # Design
    study_type = Column(String(50))  # INTERVENTIONAL, OBSERVATIONAL
    phase = Column(String(50))  # PHASE1, PHASE2, etc. (can be combined)
    enrollment_count = Column(Integer)
    enrollment_type = Column(String(20))  # ACTUAL, ESTIMATED
    
    # Conditions & interventions (stored as JSON arrays)
    conditions = Column(JSONB)  # ["Breast Cancer", "NSCLC"]
    interventions = Column(JSONB)  # [{"type": "DRUG", "name": "..."}]
    
    # Eligibility (raw)
    eligibility_criteria = Column(Text)  # raw free-text
    eligibility_sex = Column(String(10))
    eligibility_min_age = Column(String(20))
    eligibility_max_age = Column(String(20))
    eligibility_std_ages = Column(JSONB)
    
    # Eligibility (parsed by LLM)
    eligibility_parsed = Column(JSONB)  # structured extraction
    eligibility_parsed_at = Column(DateTime)
    
    # Outcomes
    primary_outcomes = Column(JSONB)
    secondary_outcomes = Column(JSONB)
    
    # Sponsor
    lead_sponsor = Column(String(500))
    lead_sponsor_class = Column(String(50))
    collaborators = Column(JSONB)
    
    # Locations (JSON array of {facility, city, state, country, lat, lon})
    locations = Column(JSONB)
    
    # Contacts
    contacts = Column(JSONB)
    officials = Column(JSONB)
    
    # Full raw JSON for anything we didn't extract
    raw_json = Column(JSONB)
    
    # Embeddings
    embedding = Column(Vector(EMBEDDING_DIM))
    
    # Timestamps
    ingested_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_studies_status", "overall_status"),
        Index("ix_studies_type", "study_type"),
        Index("ix_studies_phase", "phase"),
        Index("ix_studies_sponsor_class", "lead_sponsor_class"),
        Index("ix_studies_conditions", "conditions", postgresql_using="gin"),
        Index("ix_studies_embedding", "embedding", postgresql_using="ivfflat",
              postgresql_ops={"embedding": "vector_cosine_ops"}),
    )
