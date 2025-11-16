from fastapi import APIRouter, HTTPException
from app.models.account_opening import AccountOpeningInfo
from app.services.graph_service import (
    set_person_account_opening,
    get_person_account_opening,
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
