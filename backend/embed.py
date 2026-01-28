#!/usr/bin/env python3
"""Generate embeddings for studies and store them in pgvector."""

import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from openai import OpenAI
from tqdm import tqdm
from tenacity import retry, wait_exponential, stop_after_attempt

from config import DATABASE_URL_SYNC, OPENAI_API_KEY, EMBEDDING_MODEL, EMBEDDING_DIM
from models import Study

BATCH_SIZE = 100  # OpenAI embeddings API supports up to 2048


def build_embed_text(study: Study) -> str:
    """Build the text to embed for a study."""
    parts = []
    if study.brief_title:
        parts.append(study.brief_title)
    if study.official_title and study.official_title != study.brief_title:
        parts.append(study.official_title)
    if study.conditions:
        parts.append("Conditions: " + ", ".join(study.conditions))
    if study.interventions:
        names = [i["name"] for i in study.interventions if i.get("name")]
        if names:
            parts.append("Interventions: " + ", ".join(names))
    if study.brief_summary:
        parts.append(study.brief_summary[:1000])
    if study.eligibility_criteria:
        parts.append("Eligibility: " + study.eligibility_criteria[:500])
    return "\n".join(parts)


@retry(wait=wait_exponential(min=1, max=60), stop=stop_after_attempt(5))
def get_embeddings(client: OpenAI, texts: list[str]) -> list[list[float]]:
    """Get embeddings from OpenAI with retry."""
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [d.embedding for d in resp.data]


def main():
    engine = create_engine(DATABASE_URL_SYNC)
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    with Session(engine) as session:
        # Count studies without embeddings
        total = session.query(Study).filter(Study.embedding.is_(None)).count()
        print(f"Studies needing embeddings: {total}")
        
        if total == 0:
            print("All studies already have embeddings.")
            return
        
        pbar = tqdm(total=total, desc="Embedding", unit=" studies")
        offset = 0
        
        while True:
            studies = (
                session.query(Study)
                .filter(Study.embedding.is_(None))
                .order_by(Study.nct_id)
                .limit(BATCH_SIZE)
                .all()
            )
            if not studies:
                break
            
            texts = [build_embed_text(s) for s in studies]
            embeddings = get_embeddings(client, texts)
            
            for study, emb in zip(studies, embeddings):
                study.embedding = emb
            
            session.commit()
            pbar.update(len(studies))
        
        pbar.close()
    
    print("Done embedding.")


if __name__ == "__main__":
    main()
