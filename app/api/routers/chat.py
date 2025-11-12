from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.llm_client import get_llm_client


router = APIRouter(tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = 0.2
    max_tokens: Optional[int] = 600


@router.post("/chat")
def chat(req: ChatRequest) -> Dict[str, Any]:
    """Simple chat endpoint backed by the LLM client.

    Request JSON:
    - message: user input
    - history: optional list of {role, content} messages
    - system_prompt: optional system instruction
    - temperature, max_tokens: optional generation controls
    """
    try:
        messages: List[Dict[str, str]] = []
        if req.system_prompt:
            messages.append({"role": "system", "content": req.system_prompt})
        if req.history:
            # Keep only basic fields and valid roles
            for m in req.history[-20:]:  # cap history length
                role = m.role if m.role in {"system", "user", "assistant"} else "user"
                messages.append({"role": role, "content": m.content})
        # Append current user message
        messages.append({"role": "user", "content": req.message})

        client = get_llm_client()
        text, usage, model = client.generate(
            messages,
            temperature=float(req.temperature or 0.2),
            max_tokens=int(req.max_tokens or 600),
        )
        return {
            "reply": text,
            "model": model,
            "usage": usage,
        }
    except Exception as exc:  # pragma: no cover - surfaced as HTTP error in tests
        raise HTTPException(status_code=500, detail=str(exc))
