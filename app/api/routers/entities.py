from fastapi import APIRouter, HTTPException
from typing import Any, Dict
from app.models.ownership import (
    EntityCreate,
    OwnershipCreate,
    RepresentativeCreate,
    PersonCreate,
    CompanyCreate,
    AccountCreate,
    LocationCreate,
)
from app.services.graph_service import (
    create_entity,
    create_ownership,
    get_layers,
    clear_database,
    create_legal_rep,
    get_representatives,
    get_entity,
    create_person,
    create_company,
    create_account,
    create_location_links,
    find_entities_by_name_exact,
    resolve_entity_identifier,
    search_entities_fuzzy,
    get_person_extended,
)
from app.services.name_screening_service import basic_name_scan
from app.services.name_variant_service import expand_name_variants, match_watchlist_with_variants
from app.services.graph_rag import resolve_graphrag
from app.models.graph_rag import ResolveRAGRequest, ResolveRAGResponse
from app.services.query_parser_service import parse_person_query

router = APIRouter(tags=["entities"])

@router.post("/entities", status_code=201)
def api_create_entity(payload: EntityCreate):
    res = create_entity(payload.id, payload.name, payload.type, payload.description)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create entity")
    return res

@router.post("/ownerships", status_code=201)
def api_create_ownership(payload: OwnershipCreate):
    create_entity(payload.owner_id)
    create_entity(payload.owned_id)
    res = create_ownership(payload.owner_id, payload.owned_id, payload.stake)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create ownership")
    return res

@router.post("/persons", status_code=201)
def api_create_person(payload: PersonCreate):
    res = create_person(
        payload.id, payload.name, payload.type, payload.basic_info, payload.id_info, payload.job_info
    )
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create person")
    return res

@router.post("/companies", status_code=201)
def api_create_company(payload: CompanyCreate):
    res = create_company(
        payload.id, payload.name, payload.type, payload.business_info, payload.status, payload.industry
    )
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create company")
    return res

@router.post("/accounts", status_code=201)
def api_create_account(payload: AccountCreate):
    create_entity(payload.owner_id)
    res = create_account(payload.owner_id, payload.account_number, payload.bank_name, payload.balance)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create account")
    return res

@router.post("/locations", status_code=201)
def api_create_locations(payload: LocationCreate):
    create_entity(payload.entity_id)
    res = create_location_links(payload.entity_id, payload.registered, payload.operating, payload.offshore)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to link locations")
    return res

@router.get("/layers/{entity_id}")
def api_get_layers(entity_id: str, depth: int = 2):
    res = get_layers(entity_id, depth)
    if not res:
        raise HTTPException(status_code=404, detail="Entity not found")
    return res

@router.post("/clear-db")
def api_clear_db():
    try:
        from app.services.graph_service import clear_database
        stats = clear_database()
        return {"status": "ok", **stats}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to clear database: {exc}")

@router.post("/representatives", status_code=201)
def api_create_representative(payload: RepresentativeCreate):
    create_entity(payload.company_id)
    create_entity(payload.person_id)
    res = create_legal_rep(payload.company_id, payload.person_id, payload.role)
    if not res:
        raise HTTPException(status_code=500, detail="Failed to create representative")
    return res

@router.get("/representatives/{company_id}")
def api_get_representatives(company_id: str):
    res = get_representatives(company_id)
    if not res:
        raise HTTPException(status_code=404, detail="Company not found or no representatives")
    return res

@router.get("/entities/resolve")
def api_resolve_entity(q: str):
    try:
        res = resolve_entity_identifier(q)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to resolve entity: {exc}")
    # No direct match: still return a 404, but include basic name scan results for UX.
    if not res:
        scan = basic_name_scan(q)
        raise HTTPException(
            status_code=404,
            detail={
                "message": "Entity not found",
                "name_scan": scan,
            },
        )
    # Ambiguous match: include candidates and optional scan info.
    if res.get("ambiguous"):
        return {
            "ok": False,
            "ambiguous": True,
            "matches": res.get("matches") or [],
            "name_scan": basic_name_scan(q),
        }
    # Successfully resolved a single entity; still attach scan info for downstream UX.
    return {
        "ok": True,
        "ambiguous": False,
        "by": res.get("by"),
        "entity": res.get("resolved"),
        "name_scan": basic_name_scan(q),
    }


@router.get("/name-scan")
def api_name_scan(q: str, limit: int = 5):
    """Dedicated endpoint for running basic name scanning.

    This is intended for onboarding / KYC flows where a name needs to be
    screened even if it does not resolve to an existing entity id.
    """
    try:
        scan = basic_name_scan(q, fuzzy_limit=limit)
        # Attach LLM-based variant expansion for richer screening UX (graceful on failure)
        variant_exp = expand_name_variants(q)
        scan["variant_expansion"] = {
            "canonical": variant_exp.get("canonical"),
            "variants": variant_exp.get("variants", []),
            "usage": variant_exp.get("usage", {}),
            "model": variant_exp.get("model"),
            "trace": variant_exp.get("trace", []),
            "error": variant_exp.get("error"),
        }
        # Re-run watchlist against generated variants to surface additional hits
        variants = variant_exp.get("variants") or []
        scan["watchlist_hits_via_variants"] = match_watchlist_with_variants(q, variants) if variants else []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to run name scan: {exc}")
    return scan

@router.get("/entities/suggest")
def api_suggest_entities(q: str, limit: int = 10):
    try:
        items = search_entities_fuzzy(q, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to search entities: {exc}")
    return {"count": len(items), "items": items}


@router.post("/entities/resolve-graphrag")
def api_resolve_graphrag(payload: ResolveRAGRequest):
    """Hybrid resolver endpoint (fuzzy + optional semantic embeddings).

    Returns candidate nodes with scores and small subgraph context. This is an
    MVP integration — embeddings are computed on-the-fly for the fuzzy candidate
    set when `use_semantic` is true.
    """
    try:
        res = resolve_graphrag(
            name=payload.name,
            birth_date=payload.birth_date,
            extra=payload.extra,
            use_semantic=bool(payload.use_semantic),
            top_k=int(payload.top_k or 5),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"GraphRAG resolution failed: {exc}")
    return res


@router.post("/entities/parse-and-resolve")
def api_parse_and_resolve(payload: Dict[str, Any]):
    """Run LLM-powered parsing on free-form text, then resolve via graphRAG.

    Expected payload: { "text": "...", "use_semantic": bool, "top_k": int }
    Returns the raw resolver result (candidates, scores, metadata) plus the
    parsed fields for transparency. Does not return LLM-generated explanatory text.
    """
    try:
        text = str(payload.get("text") or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Missing text field")
        parsed = parse_person_query(text)
        extra = {
            "gender": parsed.get("gender"),
            "address_keywords": parsed.get("address_keywords"),
            "id_number_tail": parsed.get("id_number_tail"),
        }
        use_semantic = bool(payload.get("use_semantic", True))
        top_k = int(payload.get("top_k") or 5)
        res = resolve_graphrag(
            name=parsed.get("name"),
            birth_date=parsed.get("birth_date"),
            extra=extra,
            use_semantic=use_semantic,
            top_k=top_k,
        )
        return {"parsed": parsed, "resolver": res}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Parse-and-resolve failed: {exc}")

@router.get("/entities/{entity_id}")
def api_get_entity(entity_id: str):
    if entity_id in {"resolve", "suggest"}:
        raise HTTPException(status_code=400, detail="Invalid entity id reserved for endpoint")
    ent = get_entity(entity_id)
    if not ent:
        raise HTTPException(status_code=404, detail="Entity not found")
    # Attach extended person fields if available
    extended = None
    try:
        if (ent.get("type") or "").lower() == "person":
            ext = get_person_extended(entity_id)
            if ext:
                extended = {
                    k: ext.get(k)
                    for k in [
                        "basic_info",
                        "id_info",
                        "job_info",
                        "kyc_info",
                        "risk_profile",
                        "network_info",
                        "geo_profile",
                        "compliance_info",
                        "provenance",
                    ]
                    if ext.get(k) is not None
                }
    except Exception:
        # Non-fatal; return basic entity only if extended fetch fails
        extended = None
    if extended:
        return {**ent, "extended": extended}
    return ent
