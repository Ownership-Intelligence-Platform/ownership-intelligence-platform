from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.services.external_enrichment_service import enrich_person


router = APIRouter(tags=["external"])


@router.get("/external/lookup")
def api_external_lookup(
    name: str = Query(..., description="Person name to search"),
    birthdate: Optional[str] = Query(None, description="Birthdate like YYYY-MM-DD (optional)"),
):
    try:
        data = enrich_person(name=name, birthdate=birthdate, add_web_citations=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"External lookup failed: {exc}")
    if not data.get("ok"):
        raise HTTPException(status_code=400, detail=data.get("error") or "bad_request")
    return data
