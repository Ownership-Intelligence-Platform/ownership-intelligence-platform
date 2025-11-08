import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
from app.models.ownership import EntityCreate, OwnershipCreate, LayerResponse, RepresentativeCreate
from app.services.graph_service import (
    create_entity,
    create_ownership,
    get_layers,
    get_equity_penetration,
    clear_database,
    create_legal_rep,
    get_representatives,
    get_entity,
)
from app.services.news_service import get_company_news
from app.services.import_service import import_graph_from_csv, import_news_from_csv
from app.db.neo4j_connector import close_driver


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for FastAPI.

    Ensures resources (like the Neo4j driver) are closed when the application
    shuts down. This replaces the deprecated @app.on_event handlers.
    """
    try:
        yield
    finally:
        # close_driver may be synchronous; call it here to release resources
        close_driver()


app = FastAPI(title="Ownership Intelligence Platform", version="0.1", lifespan=lifespan)

# Serve static files under /static and return index.html at root so API routes remain accessible
app.mount("/static", StaticFiles(directory="static", html=True), name="static")

@app.get("/")
def read_index():
    return FileResponse("static/index.html")


@app.post("/entities", status_code=201)
def api_create_entity(payload: EntityCreate):
    res = create_entity(payload.id, payload.name, payload.type)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create entity")
    return res


@app.post("/ownerships", status_code=201)
def api_create_ownership(payload: OwnershipCreate):
    # Ensure both entities exist (MERGE in service will create if missing via create_entity)
    create_entity(payload.owner_id)
    create_entity(payload.owned_id)
    res = create_ownership(payload.owner_id, payload.owned_id, payload.stake)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create ownership")
    return res


@app.get("/layers/{entity_id}")
def api_get_layers(entity_id: str, depth: int = 2):
    res = get_layers(entity_id, depth)
    if not res:
        raise HTTPException(status_code=404, detail="Entity not found")
    return res


# shutdown handled by lifespan context manager above



@app.post("/populate-mock", status_code=201)
def api_populate_mock():
    """Populate the database with entities/ownerships from CSV files.

    Reads two CSVs (entities and ownerships) and uses the graph service to write into Neo4j.
    Paths can be provided via environment variables ENTITIES_CSV_PATH and OWNERSHIPS_CSV_PATH.
    If not set, defaults to "data/entities.csv" and "data/ownerships.csv" at the project root.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(base_dir, ".."))
    entities_csv = os.getenv("ENTITIES_CSV_PATH", os.path.join("data", "entities.csv"))
    ownerships_csv = os.getenv("OWNERSHIPS_CSV_PATH", os.path.join("data", "ownerships.csv"))

    try:
        summary = import_graph_from_csv(entities_csv, ownerships_csv, project_root=project_root)
        # Optionally import legal reps if LEGAL_REPS_CSV_PATH is set or default file exists
        legal_reps_csv = os.getenv("LEGAL_REPS_CSV_PATH", os.path.join("data", "legal_reps.csv"))
        try:
            from app.services.import_service import import_legal_reps_from_csv

            reps_summary = import_legal_reps_from_csv(legal_reps_csv, project_root=project_root)
            summary.update(reps_summary)
        except FileNotFoundError:
            # If file not found, skip silently (it's optional)
            pass
        # Optionally import news CSV
        news_csv = os.getenv("NEWS_CSV_PATH", os.path.join("data", "news.csv"))
        try:
            news_summary = import_news_from_csv(news_csv, project_root=project_root)
            summary.update(news_summary)
        except FileNotFoundError:
            pass
        return {"status": "ok", "message": "CSV data imported (writes to Neo4j).", **summary}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to import CSV data: {exc}")


@app.get("/penetration/{entity_id}")
def api_get_penetration(entity_id: str, depth: int = 3):
    res = get_equity_penetration(entity_id, depth)
    if not res:
        raise HTTPException(status_code=404, detail="Entity not found")
    return res


@app.post("/representatives", status_code=201)
def api_create_representative(payload: RepresentativeCreate):
    """Create a legal representative relationship (person -> company).

    Ensures the company and person exist as Entity nodes, then MERGE a LEGAL_REP edge.
    """
    # Ensure both nodes exist (create as bare if needed)
    create_entity(payload.company_id)
    create_entity(payload.person_id)
    res = create_legal_rep(payload.company_id, payload.person_id, payload.role)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create representative")
    return res


@app.get("/representatives/{company_id}")
def api_get_representatives(company_id: str):
    res = get_representatives(company_id)
    if not res:
        raise HTTPException(status_code=404, detail="Company not found or no representatives")
    return res


from app.services.graph_service import get_stored_news


@app.get("/entities/{entity_id}/news")
def api_get_entity_news(entity_id: str, limit: int = 10):
    """Return recent news for the given entity id.

    Resolution flow:
    1. Lookup entity node to obtain its name (falls back to id if name absent).
    2. Query external news source (NewsAPI.org if API key present; else Google News RSS).
    3. Return normalized list of items.
    """
    entity = get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    query_name = entity.get("name") or entity_id
    external_items = get_company_news(query_name, limit=limit)
    stored_items = [{**item, "stored": True} for item in get_stored_news(entity_id)]
    # Deduplicate by URL or title (prefer stored first)
    dedup = {}
    for item in stored_items + external_items:
        key = item.get("url") or item.get("title")
        if key and key not in dedup:
            dedup[key] = item
    combined = list(dedup.values())
    result_items = combined[:limit]
    return {
        "entity": {"id": entity_id, "name": entity.get("name"), "type": entity.get("type")},
        "count": len(result_items),
        "items": result_items,
        "stored_count": len(stored_items),
        "external_count": len(external_items),
    }


@app.post("/clear-db")
def api_clear_db():
    """Clear all nodes and relationships from the Neo4j database.

    Intended for quick re-import cycles during development.
    """
    try:
        stats = clear_database()
        return {"status": "ok", **stats}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to clear database: {exc}")
