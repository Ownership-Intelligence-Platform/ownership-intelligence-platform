import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
from app.models.ownership import (
    EntityCreate,
    OwnershipCreate,
    LayerResponse,
    RepresentativeCreate,
    PersonCreate,
    CompanyCreate,
    AccountCreate,
    LocationCreate,
    TransactionCreate,
    GuaranteeCreate,
    SupplyLinkCreate,
    EmploymentCreate,
)
from app.services.graph_service import (
    create_entity,
    create_ownership,
    get_layers,
    get_equity_penetration,
    get_equity_penetration_with_paths,
    clear_database,
    create_legal_rep,
    get_representatives,
    get_entity,
    create_person,
    create_company,
    create_account,
    create_location_links,
    create_transaction,
    create_guarantee,
    create_supply_link,
    create_employment,
    get_accounts,
    get_transactions,
)
from app.services.news_service import get_company_news
from app.services.import_service import (
    import_graph_from_csv,
    import_news_from_csv,
    import_accounts_from_csv,
    import_locations_from_csv,
    import_transactions_from_csv,
    import_guarantees_from_csv,
    import_supply_chain_from_csv,
    import_employment_from_csv,
)
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


# --- Phase 3: extended endpoints ---

@app.post("/persons", status_code=201)
def api_create_person(payload: PersonCreate):
    res = create_person(
        payload.id,
        payload.name,
        payload.type,
        payload.basic_info,
        payload.id_info,
        payload.job_info,
    )
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create person")
    return res


@app.post("/companies", status_code=201)
def api_create_company(payload: CompanyCreate):
    res = create_company(
        payload.id,
        payload.name,
        payload.type,
        payload.business_info,
        payload.status,
        payload.industry,
    )
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create company")
    return res


@app.post("/accounts", status_code=201)
def api_create_account(payload: AccountCreate):
    # Ensure the owner node exists
    create_entity(payload.owner_id)
    res = create_account(payload.owner_id, payload.account_number, payload.bank_name, payload.balance)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create account")
    return res


@app.post("/locations", status_code=201)
def api_create_locations(payload: LocationCreate):
    # Ensure the entity node exists
    create_entity(payload.entity_id)
    res = create_location_links(payload.entity_id, payload.registered, payload.operating, payload.offshore)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to link locations")
    return res


@app.post("/transactions", status_code=201)
def api_create_transaction(payload: TransactionCreate):
    # Ensure both nodes exist
    create_entity(payload.from_id)
    create_entity(payload.to_id)
    res = create_transaction(payload.from_id, payload.to_id, payload.amount, payload.time, payload.tx_type, payload.channel)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create transaction")
    return res


@app.post("/guarantees", status_code=201)
def api_create_guarantee(payload: GuaranteeCreate):
    # Ensure both nodes exist
    create_entity(payload.guarantor_id)
    create_entity(payload.guaranteed_id)
    res = create_guarantee(payload.guarantor_id, payload.guaranteed_id, payload.amount)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create guarantee")
    return res


@app.post("/supply-links", status_code=201)
def api_create_supply_link(payload: SupplyLinkCreate):
    # Ensure both nodes exist
    create_entity(payload.supplier_id)
    create_entity(payload.customer_id)
    res = create_supply_link(payload.supplier_id, payload.customer_id, payload.frequency)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create supply link")
    return res


@app.post("/employment", status_code=201)
def api_create_employment(payload: EmploymentCreate):
    # Ensure both nodes exist
    create_entity(payload.company_id)
    create_entity(payload.person_id)
    res = create_employment(payload.company_id, payload.person_id, payload.role)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create employment relation")
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

        # Phase 2 optional imports (skip silently if files not present)
        try:
            from app.services.graph_service import (
                create_account,
                create_location_links,
                create_transaction,
                create_guarantee,
                create_supply_link,
                create_employment,
            )

            accounts_csv = os.getenv("ACCOUNTS_CSV_PATH", os.path.join("data", "accounts.csv"))
            try:
                acc_summary = import_accounts_from_csv(
                    accounts_csv,
                    project_root=project_root,
                    create_account_fn=create_account,
                )
                summary.update(acc_summary)
            except FileNotFoundError:
                pass

            locations_csv = os.getenv("LOCATIONS_CSV_PATH", os.path.join("data", "locations.csv"))
            try:
                loc_summary = import_locations_from_csv(
                    locations_csv,
                    project_root=project_root,
                    create_location_links_fn=create_location_links,
                )
                summary.update(loc_summary)
            except FileNotFoundError:
                pass

            transactions_csv = os.getenv("TRANSACTIONS_CSV_PATH", os.path.join("data", "transactions.csv"))
            try:
                tx_summary = import_transactions_from_csv(
                    transactions_csv,
                    project_root=project_root,
                    create_transaction_fn=create_transaction,
                )
                summary.update(tx_summary)
            except FileNotFoundError:
                pass

            guarantees_csv = os.getenv("GUARANTEES_CSV_PATH", os.path.join("data", "guarantees.csv"))
            try:
                g_summary = import_guarantees_from_csv(
                    guarantees_csv,
                    project_root=project_root,
                    create_guarantee_fn=create_guarantee,
                )
                summary.update(g_summary)
            except FileNotFoundError:
                pass

            supply_csv = os.getenv("SUPPLY_CHAIN_CSV_PATH", os.path.join("data", "supply_chain.csv"))
            try:
                s_summary = import_supply_chain_from_csv(
                    supply_csv,
                    project_root=project_root,
                    create_supply_link_fn=create_supply_link,
                )
                summary.update(s_summary)
            except FileNotFoundError:
                pass

            employment_csv = os.getenv("EMPLOYMENT_CSV_PATH", os.path.join("data", "employment.csv"))
            try:
                e_summary = import_employment_from_csv(
                    employment_csv,
                    project_root=project_root,
                    create_employment_fn=create_employment,
                )
                summary.update(e_summary)
            except FileNotFoundError:
                pass
        except Exception:
            # Import helpers are best-effort; if anything unexpected happens, continue with base summary
            pass
        return {"status": "ok", "message": "CSV data imported (writes to Neo4j).", **summary}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to import CSV data: {exc}")


@app.get("/penetration/{entity_id}")
def api_get_penetration(entity_id: str, depth: int = 3, include_paths: bool = False, max_paths: int = 3):
    if include_paths:
        res = get_equity_penetration_with_paths(entity_id, depth, max_paths)
    else:
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


@app.get("/entities/{entity_id}/accounts")
def api_get_entity_accounts(entity_id: str):
    """List accounts linked to an entity via HAS_ACCOUNT."""
    # Best-effort: if entity doesn't exist, return empty list to keep UI simple
    # but we can still check for existence to return 404 if you prefer strict behavior.
    accounts = get_accounts(entity_id)
    return {"entity": {"id": entity_id}, "count": len(accounts), "items": accounts}


@app.get("/entities/{entity_id}/transactions")
def api_get_entity_transactions(entity_id: str, direction: str = "out"):
    """List transactions related to an entity.

    direction: out | in | both
    """
    items = get_transactions(entity_id, direction=direction)
    return {"entity": {"id": entity_id}, "count": len(items), "items": items}


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
