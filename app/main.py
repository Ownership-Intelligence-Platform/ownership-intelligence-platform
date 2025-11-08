import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager
from app.models.ownership import EntityCreate, OwnershipCreate, LayerResponse
from app.services.graph_service import create_entity, create_ownership, get_layers
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

# serve a small static UI from the repo root `static/` directory
app.mount("/", StaticFiles(directory="static", html=True), name="static")


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


@app.get("/mock-data")
def api_mock_data():
    """Return client-side mock data (does not touch the DB)."""
    data = {
        "entities": [
            {"id": "E1", "name": "Alpha", "type": "Company"},
            {"id": "E2", "name": "Beta", "type": "Company"},
            {"id": "E3", "name": "Gamma", "type": "Holding"},
        ],
        "ownerships": [
            {"owner_id": "E1", "owned_id": "E2", "stake": 60.0},
            {"owner_id": "E2", "owned_id": "E3", "stake": 40.0},
        ],
    }
    return data


@app.post("/populate-mock", status_code=201)
def api_populate_mock():
    """Populate the database with example entities/ownerships using graph_service.

    This endpoint will attempt to create three entities and two ownership relations
    using the existing service functions. It requires Neo4j to be running and
    configured via environment variables or defaults.
    """
    try:
        # create sample entities
        create_entity("E1", "Alpha", "Company")
        create_entity("E2", "Beta", "Company")
        create_entity("E3", "Gamma", "Holding")

        # create sample ownerships
        create_ownership("E1", "E2", 60.0)
        create_ownership("E2", "E3", 40.0)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to populate mock data: {exc}")

    return {"status": "ok", "message": "Mock data populated (writes to Neo4j)."}
