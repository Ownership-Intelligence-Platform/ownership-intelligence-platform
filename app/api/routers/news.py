from fastapi import APIRouter, HTTPException
from app.services.graph_service import get_entity, get_stored_news
from app.services.news_service import get_company_news

router = APIRouter(tags=["news"])

@router.get("/entities/{entity_id}/news")
def api_get_entity_news(entity_id: str, limit: int = 10):
    entity = get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    query_name = entity.get("name") or entity_id
    external_items = get_company_news(query_name, limit=limit)
    stored_items = [{**item, "stored": True} for item in get_stored_news(entity_id)]
    dedup = {}
    for item in stored_items + external_items:
        key = item.get("url") or item.get("title")
        if key and key not in dedup:
            dedup[key] = item
    combined = list(dedup.values())
    result_items = combined[:limit]
    return {
        "entity": {"id": entity_id, "name": entity.get("name"), "type": entity.get("type"), "description": entity.get("description")},
        "count": len(result_items),
        "items": result_items,
        "stored_count": len(stored_items),
        "external_count": len(external_items),
    }
