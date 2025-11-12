# Ownership Intelligence Platform (initial scaffold)

This repository contains a minimal Python FastAPI project that demonstrates layering ownership structures using Neo4j as a graph database.

## Frontend

The frontend now has two pages:

1. `static/index.html` — Main dashboard (ownership layers, representatives, accounts, transactions, news, penetration graph) plus a card linking to the Data Console.
2. `static/data_console.html` — Dedicated Data Console for creating entities and linking related models (accounts, locations, transactions, guarantees, supply links, employment).

Navigation: Use the "Open Data Console" button on the home page, or directly visit `/data-console`.

### Development

Open http://localhost:8000/ for the dashboard and http://localhost:8000/data-console for the Data Console.

Additionally, a person-centric relationship page is available at `/static/person_network.html`. The main dashboard's Legal Representatives list links to this page for each representative.

Home page cards include:

- Ownership Layers, Legal Representatives, Accounts, Transactions
- NEW: Guarantees, Supply Chain, Employment, Locations (each with quick loaders similar to Accounts/Transactions)
- NEW: AI Assistant chat — type questions in the chat box; the backend calls the configured LLM

# Ownership Intelligence Platform (initial scaffold)

This repository contains a minimal Python FastAPI project that demonstrates layering ownership structures using Neo4j as a graph database.

What I added:

- `requirements.txt` - Python dependencies
- `docker-compose.yml` - starts a local Neo4j instance with default credentials (neo4j/testpassword)
- `app/` - application package
  - `app/main.py` - FastAPI app initialization (lifespan, static files) registering modular routers
  - `app/api/routers/` - extracted APIRouter modules (`core`, `entities`, `analysis`, `news`, `network`, `subresources`) providing all previous endpoints with unchanged paths
  - `app/db/neo4j_connector.py` - small Neo4j helper using environment variables
  - `app/models/ownership.py` - Pydantic models
  - `app/services/graph/` - modular graph operations split into focused files (entities, ownerships, layers, penetration, legal, news, accounts, transactions, guarantees, supply_chain, employment, locations, admin)
    - Backwards compatibility: `app/services/graph_service.py` now re-exports the public API from the new package, so existing imports keep working.
    - `app/services/import_service.py` - CSV import of entities and ownerships
    - Legal representatives: LEGAL_REP edges and endpoints
    - `app/services/news_service.py` - fetch recent news for a company (NewsAPI or Google News RSS fallback)
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

Optional: set a News API key if you have one (uses NewsAPI.org when set; otherwise falls back to Google News RSS):

```powershell
$env:NEWSAPI_KEY = "<your_newsapi_key>"
```

4. Example usage (JSON body):

- Create entity: POST /entities
  { "id": "E1", "name": "Alpha" }
- Create ownership: POST /ownerships
  { "owner_id": "E1", "owned_id": "E2", "stake": 51 }
- Get layers: GET /layers/E1?depth=2
- Get company news by entity id: GET /entities/E1/news?limit=10

5. Reset (clear) the database quickly for re-import cycles:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/clear-db -Method POST
```

Or click the "Clear Imported Data (DB)" button in the web UI (served at `/`). This will delete ALL nodes and relationships (via `MATCH (n) DETACH DELETE n`). Use only in development.

## LLM Report Generation

You can now generate a CDD snapshot report via the new endpoint:

- `GET /reports/cdd/{entity_id}` parameters:
  - `refresh` (bool, default false): force regeneration (ignore cached markdown)
  - `depth` (int, default 3): ownership penetration depth
  - `news_limit` (int, default 10): number of external news items to fetch
  - `bilingual` (bool, default false): produce Chinese + English mixed sections
  - `format` (string, md|html, default md): additionally write and return HTML when `html`

Environment variables for the LLM client:

```powershell
$env:LLM_API_KEY = "<your_key>"            # OR use DASHSCOPE_API_KEY / OPENAI_API_KEY
$env:DASHSCOPE_API_KEY = "<dashscope_key>"  # If using Qwen on DashScope
$env:LLM_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1" # Optional (auto-set when DASHSCOPE_API_KEY provided)
$env:LLM_MODEL = "qwen-plus"                # Model name, default qwen-plus
```

## AI Assistant Chat

There is a built-in chat box on the main dashboard ("AI Assistant" card). It posts to `POST /chat` with the following JSON body:

```json
{
  "message": "Your question",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "system_prompt": "You are a helpful assistant for ownership analysis.",
  "temperature": 0.2,
  "max_tokens": 600
}
```

Response:

```json
{ "reply": "...", "model": "...", "usage": { "total_tokens": 123 } }
```

It uses the same `LLM_API_KEY` / `DASHSCOPE_API_KEY` and optional `LLM_BASE_URL` variables described above. If no key is provided, the endpoint returns HTTP 500 with a helpful message. To use Alibaba DashScope (Qwen), set:

```powershell
$env:DASHSCOPE_API_KEY = "<your_dashscope_key>"
# optional; auto-set when DASHSCOPE_API_KEY is present
$env:LLM_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
```

Example (PowerShell):

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/reports/cdd/E1?depth=3&news_limit=5" -Method GET | Out-File -FilePath report_E1.json
```

The response contains the markdown report content and path under `reports/<entity_id>.md`. If `format=html` is used, it also returns `content_html` and writes `reports/<entity_id>.html`. If the `.md` file exists and `refresh=false`, it returns the cached version.

Failure fallback: If the LLM call fails (missing key or network error) a deterministic markdown report is generated with key data and a manual review recommendation.

### Web-assisted answers (optional)

The chat box has a "Use Web Search" toggle. When enabled, the backend will:

- Run a quick DuckDuckGo HTML search for the question
- Crawl the top results with short timeouts
- Extract page text and prepend a brief context block (with citations) to the LLM

You can also call the API directly with:

```json
{
  "message": "What is beneficial ownership?",
  "use_web": true,
  "web_k": 3,
  "web_timeout": 6.0
}
```

The response will include a `sources` array with `{title, url}` for rendering citations. Dependencies:

- `httpx`, `beautifulsoup4`, `readability-lxml`, `lxml` (added to `requirements.txt`).

Notes:

- Web search is best-effort and time-bounded; failures fall back to a normal LLM reply.
- No external API keys are required; DuckDuckGo HTML is used for lightweight search.

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
- news.csv (optional): `entity_id,title,url,source,published_at,summary`
- accounts.csv (optional): `owner_id,account_number,bank_name,balance`
- locations.csv (optional): `entity_id,registered,operating,offshore`
- transactions.csv (optional): `from_id,to_id,amount,time,tx_type,channel`
- guarantees.csv (optional): `guarantor_id,guaranteed_id,amount`
- supply_chain.csv (optional): `supplier_id,customer_id,frequency`
- employment.csv (optional): `company_id,person_id,role`

The import returns a summary with counts of processed rows and unique items imported. It will also auto-create missing entities referenced by ownerships.

Legal representatives

- Create: `POST /representatives`
  Body: `{ "company_id": "E1", "person_id": "P1", "role": "Corporate Legal Representative" }`
- List for a company: `GET /representatives/{company_id}`

You can bulk-load legal reps during `POST /populate-mock` by providing a CSV at `data/legal_reps.csv` or setting `$env:LEGAL_REPS_CSV_PATH` to a custom path. If the file is not present, the import silently skips this step.

You can also bulk-load stored news items with `data/news.csv` or by setting `$env:NEWS_CSV_PATH` to a custom file. Each row creates a `News` node and links it to the entity via `HAS_NEWS`. The `/entities/{id}/news` endpoint merges stored items with external fetched news (deduped by URL or title) and returns a combined list.

Person network

- Endpoint: `GET /person-network/{person_id}` returns the person, nodes, and links representing:
  - Direct person→company edges (LEGAL_REP, SERVES_AS)
  - Person↔person edges (SHARE_COMPANY) for people connected to the same company
- UI: open `/static/person_network.html?person=PID` or click on a representative in the dashboard's Legal Representatives list.

Company news endpoint

- Endpoint: `GET /entities/{entity_id}/news?limit=10`
- It resolves the entity name from Neo4j and searches for recent articles.
- When `NEWSAPI_KEY` (or `NEWS_API_KEY`) is present, it uses NewsAPI.org; otherwise it uses Google News RSS.
- Response example:

```
{
  "entity": {"id": "E1", "name": "ExampleCorp", "type": "Company"},
  "count": 2,
  "items": [
    {
      "title": "ExampleCorp announces Q3 results",
      "url": "https://example.com/article1",
      "source": "Example News",
      "published_at": "Fri, 01 Nov 2024 12:00:00 GMT",
      "summary": "Strong revenue growth reported."
    }
  ]
}
```

Next steps and suggestions

- Add more validation and uniqueness rules.
- Add authentication and role-based access.
- Add integration tests that run against a test Neo4j container.

If you'd like, I can:

- wire up async Neo4j usage
- add OpenAPI examples and response models
- add an integration test that spins up the Neo4j container automatically

## API reference (selected)

Creation endpoints (subset):

- `POST /accounts`, `POST /locations`, `POST /transactions`, `POST /guarantees`, `POST /supply-links`, `POST /employment`

Query/list endpoints:

- `GET /entities/{entity_id}/accounts` — list bank accounts for the entity
- `GET /entities/{entity_id}/transactions?direction=out|in|both` — list transactions related to the entity
- `GET /entities/{entity_id}/guarantees?direction=out|in|both` — list guarantees where the entity is guarantor/beneficiary/both
- `GET /entities/{entity_id}/supply-chain?direction=out|in|both` — list supply links where the entity is supplier/customer/both
- `GET /entities/{entity_id}/employment?role=as_company|as_person|both` — list employment (SERVES_AS) relations
- `GET /entities/{entity_id}/locations` — grouped locations (registered/operating/offshore)

UI usage on home page:

- Set Root Entity ID (now accepts either a raw entity id like `E1` or an exact entity name such as `Alpha`). When a name is entered the client resolves it via `/entities/resolve` and normalizes the input field to the canonical id.
- Use each card's Load button to fetch and display corresponding tables.

### Entity resolution (ID or name)

You can now type an entity's exact name instead of its id in the "Root Entity ID" field. Resolution flow:

1. Try direct id match.
2. If no id match, perform a case-insensitive exact name match.
3. If exactly one match, the field is replaced with the resolved id and subsequent requests use that id.
4. If multiple entities share the same exact name, a dialog lists the matches for manual disambiguation.
5. If none found, an alert indicates no match.

Endpoint: `GET /entities/resolve?q=<value>` returns:

```json
{
  "ok": true,
  "by": "id",
  "entity": { "id": "E1", "name": "Alpha", "type": "Company" }
}
```

or, for ambiguous names:

```json
{
  "ok": false,
  "ambiguous": true,
  "matches": [
    { "id": "C1", "name": "Acme Holdings Ltd" },
    { "id": "C2", "name": "Acme Holdings Ltd" }
  ]
}
```

or 404 with `{"detail": "Entity not found"}`.

Implementation details:

- Back-end helper `resolve_entity_identifier` first checks id, then exact (case-insensitive) name.
- Ambiguity is reported with HTTP 200 (client-side disambiguation) but flagged via `ambiguous: true`.
- Frontend stores the resolved id back into the input for consistency across subsequent loads.
