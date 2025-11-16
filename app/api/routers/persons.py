from fastapi import APIRouter, HTTPException
import csv
import os
from typing import Optional, Dict
from app.models.account_opening import AccountOpeningInfo
from app.models.relationships import RelationshipCreate
from app.services.graph_service import (
    set_person_account_opening,
    get_person_account_opening,
    create_person_relationship,
)


router = APIRouter(tags=["persons"])


@router.get("/persons/{person_id}/account-opening")
def api_get_person_account_opening(person_id: str):
    data = get_person_account_opening(person_id)
    if not data:
        # Return 200 with empty payload rather than 404 for easier UI handling
        return {"person": {"id": person_id}, "account_opening": None}
    return {"person": {"id": person_id}, "account_opening": data}


@router.put("/persons/{person_id}/account-opening")
def api_put_person_account_opening(person_id: str, payload: AccountOpeningInfo):
    try:
        stored = set_person_account_opening(person_id, payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update account opening info: {exc}")
    return {"person": {"id": person_id}, "account_opening": stored}


def _try_load_opening_from_csv(person_id: str) -> Optional[Dict]:
    """Best-effort: look up a person's opening info from CSV by id.

    Uses env PERSON_ACCOUNT_OPENING_CSV_PATH or defaults to data/person_account_opening.csv.
    Returns a dict (without person_id) or None.
    """
    path = os.environ.get("PERSON_ACCOUNT_OPENING_CSV_PATH") or os.path.join("data", "person_account_opening.csv")
    try:
        if not os.path.isfile(path):
            return None
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            if "person_id" not in (reader.fieldnames or []):
                return None
            for row in reader:
                if (row.get("person_id") or "").strip() == person_id:
                    return {k: v for k, v in row.items() if k != "person_id" and v not in (None, "")}
    except Exception:
        return None
    return None


@router.post("/persons/{person_id}/relationships")
def api_create_relationship(person_id: str, payload: RelationshipCreate):
    """Create an interpersonal relationship for the subject person.

    If account_opening is provided for the related person, it will be stored.
    Otherwise we try to look up opening info from CSV (best-effort).
    """
    try:
        link = create_person_relationship(
            subject_id=person_id,
            related_id=payload.related_id,
            relation=payload.relation,
            subject_name=None,
            related_name=payload.related_name,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create relationship: {exc}")

    # Handle account opening for the related person per requirement
    ao = payload.account_opening.model_dump() if payload.account_opening else _try_load_opening_from_csv(payload.related_id)
    stored = None
    if ao:
        try:
            stored = set_person_account_opening(payload.related_id, ao)
        except Exception:
            stored = None

    return {
        "relationship": link,
        "related_person": {"id": payload.related_id, "name": payload.related_name},
        "account_opening": stored,
    }
