from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class EntityCreate(BaseModel):
    id: str = Field(..., description="Unique entity id")
    name: Optional[str]
    type: Optional[str]


class OwnershipCreate(BaseModel):
    owner_id: str
    owned_id: str
    stake: Optional[float] = Field(None, description="Ownership percentage (0-100)")


class EntityOut(BaseModel):
    id: str
    name: Optional[str]
    type: Optional[str]


class OwnershipOut(BaseModel):
    owner: EntityOut
    owned: EntityOut
    stake: Optional[float]


class LayerNode(BaseModel):
    id: str
    name: Optional[str]
    type: Optional[str]


class LayerResponse(BaseModel):
    root: LayerNode
    layers: List[Dict[str, Any]]
