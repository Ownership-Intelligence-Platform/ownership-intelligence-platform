import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
from app.models.ownership import EntityCreate, OwnershipCreate, LayerResponse
from app.services.graph_service import create_entity, create_ownership, get_layers, get_equity_penetration, clear_database
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
    """Populate the database with example entities/ownerships using graph_service.

    This endpoint will attempt to create three entities and two ownership relations
    using the existing service functions. It requires Neo4j to be running and
    configured via environment variables or defaults.
    """
    try:
        # create sample entities (richer graph)
        create_entity("E1", "Alpha", "Company")
        create_entity("E2", "Beta", "Company")
        create_entity("E3", "Gamma", "Holding")
        create_entity("E4", "Delta", "Subsidiary")
        create_entity("E5", "Epsilon", "SPV")
        create_entity("E6", "Zeta", "JV")

        # create sample ownerships
        create_ownership("E1", "E2", 60.0)
        create_ownership("E1", "E3", 20.0)
        create_ownership("E2", "E4", 50.0)
        create_ownership("E3", "E4", 30.0)  # multiple paths to E4
        create_ownership("E2", "E5", 100.0)
        create_ownership("E5", "E6", 25.0)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to populate mock data: {exc}")

    return {"status": "ok", "message": "Mock data populated (writes to Neo4j)."}


@app.get("/penetration/{entity_id}")
def api_get_penetration(entity_id: str, depth: int = 3):
    res = get_equity_penetration(entity_id, depth)
    if not res:
        raise HTTPException(status_code=404, detail="Entity not found")
    return res


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
