from fastapi import APIRouter, HTTPException
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
)
from app.services.name_screening_service import basic_name_scan
from app.services.name_variant_service import expand_name_variants, match_watchlist_with_variants

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

@router.get("/entities/{entity_id}")
def api_get_entity(entity_id: str):
    if entity_id in {"resolve", "suggest"}:
        raise HTTPException(status_code=400, detail="Invalid entity id reserved for endpoint")
    ent = get_entity(entity_id)
    if not ent:
        raise HTTPException(status_code=404, detail="Entity not found")
    return ent
