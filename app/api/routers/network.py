from fastapi import APIRouter, HTTPException
from app.services.graph_service import get_person_network

router = APIRouter(tags=["network"])

@router.get("/person-network/{person_id}")
def api_get_person_network(person_id: str):
    """Return a person-centric relationship graph."""
    try:
        graph = get_person_network(person_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build person network: {exc}")
    if not graph:
        raise HTTPException(status_code=404, detail="Person not found")
    return graph
