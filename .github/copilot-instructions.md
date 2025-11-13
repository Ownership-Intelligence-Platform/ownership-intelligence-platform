# Copilot Custom Instruction — Ownership Intelligence Platform

Use this instruction in every Copilot chat to keep responses aligned with this repository.

## Project overview

- Name: Ownership Intelligence Platform
- Purpose: Analyze and visualize ownership structures, related entities, transactions, and risk signals using a FastAPI backend, Neo4j graph database, and a lightweight static UI.
- Capabilities:
  - Entity CRUD, ownership graphs, penetration paths, person networks
  - CSV imports for quick population
  - News enrichment and basic risk knowledge base
  - LLM-powered chat and CDD report generation (OpenAI-compatible, supports DashScope/Qwen)

## Tech stack

- Python 3.11
- FastAPI + Uvicorn
- Neo4j (Python driver 5/6)
- Pydantic (2.x preferred — see `pyproject.toml`)
- httpx, BeautifulSoup, readability-lxml, lxml, selectolax
- APScheduler, tenacity
- OpenAI-compatible client (`openai` package)
- pytest

## Key files and structure

- App entry: `app/main.py` — FastAPI app, static mount, routers, lifespan
- Routers: `app/api/routers/` — `core`, `entities`, `analysis`, `news`, `network`, `subresources`, `risk_kb`, `reports`, `chat`
- Graph layer: `app/services/graph/` (split modules); facade `app/services/graph_service.py` re-exports public API
- Neo4j access: `app/db/neo4j_connector.py` — driver and `.env` loading
- LLM client: `app/services/llm_client.py` — OpenAI-compatible wrapper
- UI: `static/` with `index.html`, `data_console.html`, and `static/modules/*.js`
- Data: `data/*.csv` (+ `data/scraped/news`)
- Tests: `tests/*.py` with fixtures in `tests/fixtures/`
- Orchestration: `docker-compose.yml` (Neo4j)
- Config: `pyproject.toml`, `requirements.txt`, `pytest.ini`
- Docs: `docs/*.md`
- Reports cache/output: `reports/*.md|html`

## Run locally (Windows PowerShell)

1. Create venv and install deps

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Start Neo4j via Docker

```powershell
docker-compose up -d
```

3. Env (if not defaults)

```powershell
$env:NEO4J_URI='bolt://localhost:7687'; $env:NEO4J_USER='neo4j'; $env:NEO4J_PASSWORD='testpassword'
```

4. Start API

```powershell
uvicorn app.main:app --reload
```

5. Open UI

- Dashboard: http://localhost:8000/
- Data Console: http://localhost:8000/data-console
- Person network: `/static/person_network.html?person=<ID>`

## LLM configuration

- Required: one of `LLM_API_KEY`, `OPENAI_API_KEY`, or `DASHSCOPE_API_KEY`
- Optional: `LLM_BASE_URL` (auto for DashScope), `LLM_MODEL` (default `qwen-plus`)

```powershell
$env:DASHSCOPE_API_KEY='<your_key>'; $env:LLM_BASE_URL='https://dashscope.aliyuncs.com/compatible-mode/v1'; $env:LLM_MODEL='qwen-plus'
```

## Common APIs and flows (selected)

- Entity resolution: `GET /entities/resolve?q=<id-or-exact-name>` (handles ambiguity)
- News: `GET /entities/{id}/news?limit=10` (NewsAPI if key present, else Google News RSS)
- Person network: `GET /person-network/{person_id}`
- CSV import: `POST /populate-mock` using `data/*.csv` (override via env: `*_CSV_PATH`)
- Reports (CDD): `GET /reports/cdd/{entity_id}?depth=3&news_limit=5&format=md|html`
- Chat: `POST /chat` with `{ message, history?, system_prompt?, temperature?, max_tokens?, use_web? }` (optional web search + citations)

## Environment variables

- Neo4j: `NEO4J_URI` (default `bolt://localhost:7687`), `NEO4J_USER` (`neo4j`), `NEO4J_PASSWORD`
- LLM: `LLM_API_KEY` or `OPENAI_API_KEY` or `DASHSCOPE_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`
- News: `NEWSAPI_KEY` / `NEWS_API_KEY`
- Import paths: `ENTITIES_CSV_PATH`, `OWNERSHIPS_CSV_PATH`, `LEGAL_REPS_CSV_PATH`, `NEWS_CSV_PATH`, `ACCOUNTS_CSV_PATH`, etc.
- Bing Search (optional web): `BING_SEARCH_API_KEY`, `BING_SEARCH_ENDPOINT`

## Testing

```powershell
pytest
```

Scope: models, imports, services, routers, crawl, person networks, reports. Prefer fast tests and small fixtures.

## Conventions

- Routers: place API endpoints in `app/api/routers/` and register in `app/main.py`
- Models: use Pydantic for requests/responses; return JSON-safe data
- Graph: put Cypher in `app/services/graph/*.py`; import via `graph_service` for compatibility
- Errors: raise `HTTPException` for API; actionable `RuntimeError` in services
- LLM: use `get_llm_client()`; keep prompts small; return usage and model name
- Web search: small timeouts; degrade gracefully; include citations when used
- Code quality: type hints; short functions; explicit Windows PowerShell in snippets
- Data safety: don’t log secrets or hardcode keys

## Non-goals (current)

- AuthN/AuthZ and multi-tenancy
- Heavy UI frameworks/build pipelines
- Relational backing stores or migrations

## How Copilot should help

- “Add an endpoint”: create Pydantic models, add a router or route, register in `app/main.py`, add 1–2 pytest tests.
- “New graph query/feature”: add service in `app/services/graph/*.py`, re-export if needed via `graph_service.py`, and test.
- “Import logic”: extend `import_service.py`, support env overrides, document CSV formats, test with fixtures.
- “News/web search feature”: honor timeouts and key presence; add citations; test deterministic fallbacks.
- “LLM feature”: use `llm_client.py`, return usage and model; test with a stubbed client when possible.
- Assume Windows + PowerShell in shell snippets. Prefer absolute file paths and explicit repo references in guidance.
- After significant changes: run tests and summarize PASS/FAIL briefly.

## Pointers

- App: `app/main.py`
- Routers: `app/api/routers/*.py` (e.g., `chat.py`, `entities.py`, `reports.py`)
- Graph: `app/services/graph/`, `app/services/graph_service.py`
- Neo4j: `app/db/neo4j_connector.py`
- LLM: `app/services/llm_client.py`
- UI: `static/index.html`, `static/data_console.html`, `static/modules/*.js`
- Data: `data/*.csv`
- Docs: `docs/*.md`
- Tests: `tests/*.py`
- Compose: `docker-compose.yml`
