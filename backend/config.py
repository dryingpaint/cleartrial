"""Configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://cleartrial:cleartrial@localhost:5432/cleartrial")
DATABASE_URL_SYNC = os.getenv("DATABASE_URL_SYNC", "postgresql://cleartrial:cleartrial@localhost:5432/cleartrial")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536

CT_API_BASE = "https://clinicaltrials.gov/api/v2"
CT_PAGE_SIZE = 100  # max allowed by API

# How many studies to fetch per ingest run (None = all)
INGEST_LIMIT = os.getenv("INGEST_LIMIT", None)
if INGEST_LIMIT:
    INGEST_LIMIT = int(INGEST_LIMIT)
