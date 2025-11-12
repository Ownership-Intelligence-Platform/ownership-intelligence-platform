from fastapi import APIRouter
from app.services.graph_service import (
    get_accounts,
    get_transactions,
    get_guarantees,
    get_supply_chain,
    get_employment,
    get_locations,
)

router = APIRouter(tags=["subresources"])

@router.get("/entities/{entity_id}/accounts")
def api_get_entity_accounts(entity_id: str):
    accounts = get_accounts(entity_id)
    return {"entity": {"id": entity_id}, "count": len(accounts), "items": accounts}

@router.get("/entities/{entity_id}/transactions")
def api_get_entity_transactions(entity_id: str, direction: str = "out"):
    items = get_transactions(entity_id, direction=direction)
    return {"entity": {"id": entity_id}, "count": len(items), "items": items}

@router.get("/entities/{entity_id}/guarantees")
def api_get_entity_guarantees(entity_id: str, direction: str = "out"):
    items = get_guarantees(entity_id, direction=direction)
    return {"entity": {"id": entity_id}, "count": len(items), "items": items}

@router.get("/entities/{entity_id}/supply-chain")
def api_get_entity_supply_chain(entity_id: str, direction: str = "out"):
    items = get_supply_chain(entity_id, direction=direction)
    return {"entity": {"id": entity_id}, "count": len(items), "items": items}

@router.get("/entities/{entity_id}/employment")
def api_get_entity_employment(entity_id: str, role: str = "both"):
    items = get_employment(entity_id, role=role)
    return {"entity": {"id": entity_id}, "count": len(items), "items": items}

@router.get("/entities/{entity_id}/locations")
def api_get_entity_locations(entity_id: str):
    locs = get_locations(entity_id)
    items = [
        *[{"type": "registered", "name": n} for n in locs.get("registered", [])],
        *[{"type": "operating", "name": n} for n in locs.get("operating", [])],
        *[{"type": "offshore", "name": n} for n in locs.get("offshore", [])],
    ]
    return {"entity": {"id": entity_id}, "groups": locs, "count": len(items), "items": items}
