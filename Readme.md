# Ownership Intelligence Platform (initial scaffold)

This repository contains a minimal Python FastAPI project that demonstrates layering ownership structures using Neo4j as a graph database.

What I added:

- `requirements.txt` - Python dependencies
- `docker-compose.yml` - starts a local Neo4j instance with default credentials (neo4j/testpassword)
- `app/` - application package
  - `app/main.py` - FastAPI app with endpoints to create entities, ownerships and fetch layers
  - `app/db/neo4j_connector.py` - small Neo4j helper using environment variables
  - `app/models/ownership.py` - Pydantic models
  - `app/services/graph_service.py` - graph operations (create entity, create ownership, get layers)
- `tests/test_models.py` - minimal pytest tests for models

Quickstart (development)

1. Install dependencies (prefer a venv):

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt
```

2. Start Neo4j locally (docker-compose):

```powershell
docker-compose up -d
```

The compose file sets Neo4j auth to `neo4j/testpassword`. If your environment differs, set:

- `NEO4J_URI` (default: bolt://localhost:7687)
- `NEO4J_USER` (default: neo4j)
- `NEO4J_PASSWORD` (default: testpassword)

3. Run the app:

```powershell
uvicorn app.main:app --reload
```

4. Example usage (JSON body):

- Create entity: POST /entities
  { "id": "E1", "name": "Alpha" }
- Create ownership: POST /ownerships
  { "owner_id": "E1", "owned_id": "E2", "stake": 51 }
- Get layers: GET /layers/E1?depth=2

Next steps and suggestions

- Add more validation and uniqueness rules.
- Add authentication and role-based access.
- Add integration tests that run against a test Neo4j container.

If you'd like, I can:

- wire up async Neo4j usage
- add OpenAPI examples and response models
- add an integration test that spins up the Neo4j container automatically
