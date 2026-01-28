#!/usr/bin/env python3
"""Parse eligibility criteria from free text into structured JSON using Claude."""

import json
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from anthropic import Anthropic
from tqdm import tqdm
from tenacity import retry, wait_exponential, stop_after_attempt

from config import DATABASE_URL_SYNC, ANTHROPIC_API_KEY
from models import Study

BATCH_SIZE = 10  # Process N studies per LLM call (single study per call for accuracy)

PARSE_PROMPT = """Extract structured eligibility criteria from this clinical trial text.

Return JSON with these fields (use null if not specified):
{
  "min_age_years": <number or null>,
  "max_age_years": <number or null>,
  "sex": "<male|female|all>",
  "accepts_healthy": <bool>,
  "conditions_required": ["list of required diagnoses"],
  "conditions_excluded": ["list of excluded diagnoses"],
  "biomarkers_required": ["e.g. HER2+, EGFR mutation"],
  "biomarkers_excluded": ["e.g. BRCA negative"],
  "prior_treatments_required": ["treatments patient must have had"],
  "prior_treatments_excluded": ["treatments that disqualify"],
  "stage_required": ["e.g. Stage III, Stage IV, metastatic"],
  "lab_requirements": [{"test": "name", "operator": ">|<|>=|<=|=", "value": "number", "unit": "unit"}],
  "performance_status": {"scale": "ECOG|Karnofsky", "min": <number>, "max": <number>},
  "pregnancy_allowed": <bool or null>,
  "inclusion_summary": "1-2 sentence plain English summary of who qualifies",
  "exclusion_summary": "1-2 sentence plain English summary of who doesn't qualify"
}

Eligibility criteria text:
"""


@retry(wait=wait_exponential(min=1, max=60), stop=stop_after_attempt(3))
def parse_criteria(client: Anthropic, criteria_text: str) -> dict | None:
    """Parse eligibility criteria using Claude."""
    if not criteria_text or len(criteria_text.strip()) < 20:
        return None

    resp = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": PARSE_PROMPT + criteria_text[:4000]
        }],
    )
    
    text = resp.content[0].text.strip()
    # Extract JSON from response
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    
    return json.loads(text)


def main():
    engine = create_engine(DATABASE_URL_SYNC)
    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    
    with Session(engine) as session:
        # Only parse studies that have criteria but haven't been parsed
        total = (
            session.query(Study)
            .filter(
                Study.eligibility_criteria.isnot(None),
                Study.eligibility_parsed.is_(None),
            )
            .count()
        )
        print(f"Studies needing eligibility parsing: {total}")
        
        if total == 0:
            print("All eligible studies already parsed.")
            return
        
        pbar = tqdm(total=total, desc="Parsing eligibility", unit=" studies")
        errors = 0
        
        while True:
            studies = (
                session.query(Study)
                .filter(
                    Study.eligibility_criteria.isnot(None),
                    Study.eligibility_parsed.is_(None),
                )
                .order_by(Study.nct_id)
                .limit(BATCH_SIZE)
                .all()
            )
            if not studies:
                break
            
            for study in studies:
                try:
                    parsed = parse_criteria(client, study.eligibility_criteria)
                    study.eligibility_parsed = parsed
                    study.eligibility_parsed_at = datetime.utcnow()
                except Exception as e:
                    errors += 1
                    if errors % 10 == 0:
                        print(f"\n{errors} parse errors so far. Latest: {e}")
                    # Mark as attempted with error
                    study.eligibility_parsed = {"_error": str(e)}
                    study.eligibility_parsed_at = datetime.utcnow()
            
            session.commit()
            pbar.update(len(studies))
        
        pbar.close()
    
    print(f"Done. {errors} errors.")


if __name__ == "__main__":
    main()
