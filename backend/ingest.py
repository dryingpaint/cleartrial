#!/usr/bin/env python3
"""Ingest studies from ClinicalTrials.gov API into PostgreSQL."""

import asyncio
import json
import sys
from datetime import date, datetime

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from tqdm import tqdm

from config import CT_API_BASE, CT_PAGE_SIZE, DATABASE_URL_SYNC, INGEST_LIMIT
from models import Base, Study


def parse_ct_date(d: str | None) -> date | None:
    """Parse ClinicalTrials.gov date formats (YYYY-MM-DD or YYYY-MM)."""
    if not d:
        return None
    try:
        if len(d) == 7:  # YYYY-MM
            return date.fromisoformat(d + "-01")
        return date.fromisoformat(d)
    except ValueError:
        return None


def extract_study(raw: dict) -> dict:
    """Extract fields from a ClinicalTrials.gov API study record."""
    p = raw.get("protocolSection", {})
    ident = p.get("identificationModule", {})
    status = p.get("statusModule", {})
    desc = p.get("descriptionModule", {})
    design = p.get("designModule", {})
    elig = p.get("eligibilityModule", {})
    sponsor = p.get("sponsorCollaboratorsModule", {})
    contacts = p.get("contactsLocationsModule", {})
    outcomes = p.get("outcomesModule", {})
    arms = p.get("armsInterventionsModule", {})
    
    # Parse phases
    phases = design.get("phases", [])
    phase_str = ",".join(phases) if phases else design.get("designInfo", {}).get("phase", None)

    # Parse interventions
    interventions = []
    for i in arms.get("interventions", []):
        interventions.append({"type": i.get("type"), "name": i.get("name")})

    # Parse locations
    locations = []
    for loc in contacts.get("locations", []):
        geo = loc.get("geoPoint", {})
        locations.append({
            "facility": loc.get("facility"),
            "city": loc.get("city"),
            "state": loc.get("state"),
            "country": loc.get("country"),
            "zip": loc.get("zip"),
            "lat": geo.get("lat"),
            "lon": geo.get("lon"),
        })

    # Parse contacts
    contact_list = []
    for c in contacts.get("centralContacts", []):
        contact_list.append({
            "name": c.get("name"),
            "role": c.get("role"),
            "email": c.get("email"),
            "phone": c.get("phone"),
        })

    officials = []
    for o in contacts.get("overallOfficials", []):
        officials.append({
            "name": o.get("name"),
            "affiliation": o.get("affiliation"),
            "role": o.get("role"),
        })

    # Primary/secondary outcomes
    primary = []
    for o in outcomes.get("primaryOutcomes", []):
        primary.append({
            "measure": o.get("measure"),
            "description": o.get("description"),
            "timeFrame": o.get("timeFrame"),
        })
    secondary = []
    for o in outcomes.get("secondaryOutcomes", []):
        secondary.append({
            "measure": o.get("measure"),
            "description": o.get("description"),
            "timeFrame": o.get("timeFrame"),
        })

    # Collaborators
    collabs = []
    for c in sponsor.get("collaborators", []):
        collabs.append({"name": c.get("name"), "class": c.get("class")})

    return {
        "nct_id": ident.get("nctId"),
        "brief_title": ident.get("briefTitle"),
        "official_title": ident.get("officialTitle"),
        "acronym": ident.get("acronym"),
        "org_name": ident.get("organization", {}).get("fullName"),
        "org_class": ident.get("organization", {}).get("class"),
        "overall_status": status.get("overallStatus"),
        "start_date": parse_ct_date(status.get("startDateStruct", {}).get("date")),
        "completion_date": parse_ct_date(status.get("completionDateStruct", {}).get("date")),
        "last_update_date": parse_ct_date(
            status.get("lastUpdatePostDateStruct", {}).get("date")
        ),
        "brief_summary": desc.get("briefSummary"),
        "detailed_description": desc.get("detailedDescription"),
        "study_type": design.get("studyType"),
        "phase": phase_str,
        "enrollment_count": design.get("enrollmentInfo", {}).get("count"),
        "enrollment_type": design.get("enrollmentInfo", {}).get("type"),
        "conditions": p.get("conditionsModule", {}).get("conditions", []),
        "interventions": interventions or None,
        "eligibility_criteria": elig.get("eligibilityCriteria"),
        "eligibility_sex": elig.get("sex"),
        "eligibility_min_age": elig.get("minimumAge"),
        "eligibility_max_age": elig.get("maximumAge"),
        "eligibility_std_ages": elig.get("stdAges"),
        "primary_outcomes": primary or None,
        "secondary_outcomes": secondary or None,
        "lead_sponsor": sponsor.get("leadSponsor", {}).get("name"),
        "lead_sponsor_class": sponsor.get("leadSponsor", {}).get("class"),
        "collaborators": collabs or None,
        "locations": locations or None,
        "contacts": contact_list or None,
        "officials": officials or None,
        "raw_json": raw,
    }


def fetch_and_ingest():
    """Fetch all studies from the API and upsert into the database."""
    engine = create_engine(DATABASE_URL_SYNC, echo=False)
    
    # Create tables (pgvector extension must already exist)
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(engine)

    total_ingested = 0
    next_token = None
    
    # Fields to request (skip derivedSection to save bandwidth)
    fields = "protocolSection"

    with httpx.Client(timeout=60) as client:
        pbar = tqdm(desc="Ingesting studies", unit=" studies")
        
        while True:
            params = {
                "format": "json",
                "pageSize": CT_PAGE_SIZE,
                "fields": fields,
            }
            if next_token:
                params["pageToken"] = next_token

            resp = client.get(f"{CT_API_BASE}/studies", params=params)
            resp.raise_for_status()
            data = resp.json()

            studies = data.get("studies", [])
            if not studies:
                break

            rows = [extract_study(s) for s in studies]

            with Session(engine) as session:
                stmt = insert(Study).values(rows)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["nct_id"],
                    set_={
                        k: stmt.excluded[k]
                        for k in rows[0].keys()
                        if k != "nct_id"
                    },
                )
                session.execute(stmt)
                session.commit()

            total_ingested += len(rows)
            pbar.update(len(rows))

            if INGEST_LIMIT and total_ingested >= INGEST_LIMIT:
                print(f"\nReached ingest limit ({INGEST_LIMIT})")
                break

            next_token = data.get("nextPageToken")
            if not next_token:
                break

        pbar.close()

    print(f"\nDone. Ingested {total_ingested} studies.")


if __name__ == "__main__":
    fetch_and_ingest()
