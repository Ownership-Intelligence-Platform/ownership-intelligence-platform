from fastapi import APIRouter, HTTPException, Query
from fastapi import Body
from typing import Optional

from app.services.external_enrichment_service import enrich_person, analyze_enrichment


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


@router.post("/external/analyze")
def api_external_analyze(
    name: str = Body(..., embed=True, description="Person name to analyze"),
    birthdate: Optional[str] = Body(None, embed=True),
    use_web_content: bool = Body(False, embed=True),
):
    try:
        enrichment = enrich_person(name=name, birthdate=birthdate, add_web_citations=True)
        if not enrichment.get("ok"):
            raise HTTPException(status_code=400, detail=enrichment.get("error") or "bad_request")
        analysis = analyze_enrichment(enrichment, use_web_content=use_web_content)
        return {"ok": True, "enrichment": enrichment, "analysis": analysis}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"External analysis failed: {exc}")
