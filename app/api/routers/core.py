from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os
from app.services.import_service import (
    import_graph_from_csv,
    import_news_from_csv,
    import_accounts_from_csv,
    import_person_account_opening_from_csv,
    import_locations_from_csv,
    import_transactions_from_csv,
    import_guarantees_from_csv,
    import_supply_chain_from_csv,
    import_employment_from_csv,
)
from app.db.neo4j_connector import close_driver

router = APIRouter(tags=["core"])

@router.get("/")
def read_index():
    return FileResponse("static/index.html")

@router.get("/data-console")
def read_data_console():
    return FileResponse("static/data_console.html")

@router.post("/populate-mock", status_code=201)
def populate_mock():
    """Populate the database with CSV data (entities, ownerships, optional extras)."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # project_root: two levels up (routers -> api -> app)
    project_root = os.path.abspath(os.path.join(base_dir, "..", "..", ".."))
    entities_csv = os.getenv("ENTITIES_CSV_PATH", os.path.join("data", "entities.csv"))
    ownerships_csv = os.getenv("OWNERSHIPS_CSV_PATH", os.path.join("data", "ownerships.csv"))
    try:
        summary = import_graph_from_csv(entities_csv, ownerships_csv, project_root=project_root)
        # Optional imports (ignore missing files)
        legal_reps_csv = os.getenv("LEGAL_REPS_CSV_PATH", os.path.join("data", "legal_reps.csv"))
        try:
            from app.services.import_service import import_legal_reps_from_csv
            summary.update(import_legal_reps_from_csv(legal_reps_csv, project_root=project_root))
        except FileNotFoundError:
            pass
        news_csv = os.getenv("NEWS_CSV_PATH", os.path.join("data", "news.csv"))
        try:
            summary.update(import_news_from_csv(news_csv, project_root=project_root))
        except FileNotFoundError:
            pass
        # Phase 2 optional imports
        try:
            from app.services.graph_service import (
                create_account,
                set_person_account_opening,
                create_location_links,
                create_transaction,
                create_guarantee,
                create_supply_link,
                create_employment,
            )
            accounts_csv = os.getenv("ACCOUNTS_CSV_PATH", os.path.join("data", "accounts.csv"))
            try:
                summary.update(import_accounts_from_csv(accounts_csv, project_root=project_root, create_account_fn=create_account))
            except FileNotFoundError:
                pass
            
            opening_csv = os.getenv("PERSON_ACCOUNT_OPENING_CSV_PATH", os.path.join("data", "person_account_opening.csv"))
            try:
                summary.update(
                    import_person_account_opening_from_csv(
                        opening_csv, project_root=project_root, set_opening_fn=set_person_account_opening
                    )
                )
            except FileNotFoundError:
                pass
            locations_csv = os.getenv("LOCATIONS_CSV_PATH", os.path.join("data", "locations.csv"))
            try:
                summary.update(import_locations_from_csv(locations_csv, project_root=project_root, create_location_links_fn=create_location_links))
            except FileNotFoundError:
                pass
            tx_csv = os.getenv("TRANSACTIONS_CSV_PATH", os.path.join("data", "transactions.csv"))
            try:
                summary.update(import_transactions_from_csv(tx_csv, project_root=project_root, create_transaction_fn=create_transaction))
            except FileNotFoundError:
                pass
            guarantees_csv = os.getenv("GUARANTEES_CSV_PATH", os.path.join("data", "guarantees.csv"))
            try:
                summary.update(import_guarantees_from_csv(guarantees_csv, project_root=project_root, create_guarantee_fn=create_guarantee))
            except FileNotFoundError:
                pass
            supply_csv = os.getenv("SUPPLY_CHAIN_CSV_PATH", os.path.join("data", "supply_chain.csv"))
            try:
                summary.update(import_supply_chain_from_csv(supply_csv, project_root=project_root, create_supply_link_fn=create_supply_link))
            except FileNotFoundError:
                pass
            employment_csv = os.getenv("EMPLOYMENT_CSV_PATH", os.path.join("data", "employment.csv"))
            try:
                summary.update(import_employment_from_csv(employment_csv, project_root=project_root, create_employment_fn=create_employment))
            except FileNotFoundError:
                pass
        except Exception:
            pass
        return {"status": "ok", "message": "CSV data imported (writes to Neo4j).", **summary}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to import CSV data: {exc}")
