from fastapi import APIRouter, HTTPException
from app.services.graph_service import (
    get_equity_penetration,
    get_equity_penetration_with_paths,
)
from app.services.risk_service import analyze_entity_risks

router = APIRouter(tags=["analysis"])

@router.get("/penetration/{entity_id}")
def api_get_penetration(entity_id: str, depth: int = 3, include_paths: bool = False, max_paths: int = 3):
    if include_paths:
        res = get_equity_penetration_with_paths(entity_id, depth, max_paths)
    else:
        res = get_equity_penetration(entity_id, depth)
    if not res:
        raise HTTPException(status_code=404, detail="Entity not found")
    return res

@router.get("/entities/{entity_id}/risks")
def api_get_entity_risks(entity_id: str, news_limit: int = 10):
    res = analyze_entity_risks(entity_id, news_limit=news_limit)
    if not res:
        raise HTTPException(status_code=404, detail="Entity not found")
    return res
