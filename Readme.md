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
    - `app/services/import_service.py` - CSV import of entities and ownerships
    - Legal representatives: LEGAL_REP edges and endpoints
- `tests/test_models.py` - minimal pytest tests for models
  - `tests/test_import.py` - unit test for CSV import service

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

5. Reset (clear) the database quickly for re-import cycles:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/clear-db -Method POST
```

Or click the "Clear Imported Data (DB)" button in the web UI (served at `/`). This will delete ALL nodes and relationships (via `MATCH (n) DETACH DELETE n`). Use only in development.

CSV import (populate mock data)

- Endpoint: `POST /populate-mock`
- By default it loads from `data/entities.csv` and `data/ownerships.csv` at the project root.
- You can override paths with environment variables:

```powershell
$env:ENTITIES_CSV_PATH = "data/entities.csv"; $env:OWNERSHIPS_CSV_PATH = "data/ownerships.csv"
```

CSV formats:

- entities.csv: `id,name,type`
- ownerships.csv: `owner_id,owned_id,stake` (stake is percentage 0-100)
- legal_reps.csv (optional): `company_id,person_id,role`

The import returns a summary with counts of processed rows and unique items imported. It will also auto-create missing entities referenced by ownerships.

Legal representatives

- Create: `POST /representatives`
  Body: `{ "company_id": "E1", "person_id": "P1", "role": "Corporate Legal Representative" }`
- List for a company: `GET /representatives/{company_id}`

You can bulk-load legal reps during `POST /populate-mock` by providing a CSV at `data/legal_reps.csv` or setting `$env:LEGAL_REPS_CSV_PATH` to a custom path. If the file is not present, the import silently skips this step.

Next steps and suggestions

- Add more validation and uniqueness rules.
- Add authentication and role-based access.
- Add integration tests that run against a test Neo4j container.

If you'd like, I can:

- wire up async Neo4j usage
- add OpenAPI examples and response models
- add an integration test that spins up the Neo4j container automatically
