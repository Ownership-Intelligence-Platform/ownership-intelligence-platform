from fastapi import APIRouter, HTTPException
from app.services.graph_service import (
    get_equity_penetration,
    get_equity_penetration_with_paths,
)
from app.services.risk_service import analyze_entity_risks
from app.services.risk_service import generate_risk_summary
from app.services.mock_news import get_company_news_mock

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


@router.get("/entities/{entity_id}/risk-summary")
def api_get_entity_risk_summary(entity_id: str, news_limit: int = 5, use_mock_news: bool = False):
    """Return an LLM-generated risk summary (or deterministic fallback).

    Query params:
      - news_limit: number of external news items to fetch
      - use_mock_news: when true, use the backend mock news provider (useful for testing)
    """
    try:
        if use_mock_news:
            res = generate_risk_summary(entity_id, news_limit=news_limit, get_external_news_fn=get_company_news_mock)
        else:
            res = generate_risk_summary(entity_id, news_limit=news_limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Risk summary error: {exc}")
    if not res:
        raise HTTPException(status_code=404, detail="Entity not found")
    return res
