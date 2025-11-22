from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List


class ResolveRAGRequest(BaseModel):
    name: Optional[str] = Field(None, description="Person or entity name")
    birth_date: Optional[str] = Field(None, description="ISO date or partial date (YYYY-MM-DD or YYYY)")
    extra: Optional[Dict[str, Any]] = Field(None, description="Additional fields to help matching (id_no, address, etc.)")
    use_semantic: Optional[bool] = Field(True, description="Whether to use embedding-based semantic retrieval")
    top_k: Optional[int] = Field(5, description="Number of top candidates to return")


class Candidate(BaseModel):
    node_id: str
    labels: Optional[List[str]] = None
    name: Optional[str] = None
    score: float
    matched_fields: Optional[List[str]] = None
    evidence: Optional[str] = None


class ResolveRAGResponse(BaseModel):
    query: ResolveRAGRequest
    candidates: List[Candidate]
    llm_result: Optional[Dict[str, Any]] = None
