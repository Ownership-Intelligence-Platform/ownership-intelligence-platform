from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from app.services.name_variant_service import expand_name_variants


router = APIRouter()


class ExpandRequest(BaseModel):
    name: str = Field(..., description="Input name to expand")
    locales: Optional[List[str]] = Field(default_factory=lambda: ["zh", "en"])
    include_pinyin: bool = True
    max_candidates: int = 10


@router.post("/screening/expand")
def api_expand_variants(body: ExpandRequest) -> Dict[str, Any]:
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    try:
        res = expand_name_variants(
            name,
            locales=body.locales or ["zh", "en"],
            include_pinyin=body.include_pinyin,
            max_candidates=body.max_candidates,
        )
        return res
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to expand variants: {exc}")
