from typing import List, Optional, Any
from pydantic import BaseModel

class YoutuData(BaseModel):
    retrieved_triples: List[str] = []
    retrieved_chunks: List[str] = []

class YoutuReportRequest(BaseModel):
    reply: str
    youtu_data: Optional[YoutuData] = None
    model: Optional[str] = None
