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
    # Optional: enable lightweight web search + crawl as additional context
    use_web: Optional[bool] = False
    web_k: Optional[int] = 3
    web_timeout: Optional[float] = 6.0
    web_provider: Optional[str] = "auto"  # auto|ddg|bing


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

        web_sources = []
        if req.use_web:
            try:
                # Lazy import to avoid adding test-time dependency if unused
                from app.services.web_search_service import WebSearch

                ws = WebSearch(timeout=float(req.web_timeout or 6.0), provider=(req.web_provider or "auto"))
                web_sources = ws.search_and_crawl(req.message, k=int(req.web_k or 3))
                if web_sources:
                    # Compose brief context block with citations
                    clipped = []
                    max_chars = 2500
                    total = 0
                    for s in web_sources:
                        snippet = (s.get("content") or "").strip()
                        title = s.get("title") or s.get("url") or "Source"
                        url = s.get("url") or ""
                        piece = f"[Source] {title} — {url}\n{snippet}\n\n"
                        # Char-budget clip
                        if total + len(piece) > max_chars:
                            remaining = max_chars - total
                            if remaining > 200:  # keep at least some context
                                piece = piece[:remaining]
                                clipped.append(piece)
                                total += len(piece)
                            break
                        clipped.append(piece)
                        total += len(piece)
                    if clipped:
                        messages.insert(0, {
                            "role": "system",
                            "content": (
                                "You can use the following recent web results as context. "
                                "Cite URLs inline when you rely on them. If irrelevant, ignore.\n\n"
                            ) + "".join(clipped)
                        })
            except Exception as _exc:
                # Non-fatal: proceed without web if anything fails
                web_sources = []

        client = get_llm_client()
        text, usage, model = client.generate(
            messages,
            temperature=float(req.temperature or 0.2),
            max_tokens=int(req.max_tokens or 600),
        )
        resp: Dict[str, Any] = {
            "reply": text,
            "model": model,
            "usage": usage,
        }
        if req.use_web:
            # Return lightweight source metadata for UI display
            resp["sources"] = [
                {"title": s.get("title"), "url": s.get("url")}
                for s in (web_sources or [])
                if s.get("url")
            ]
        return resp
    except Exception as exc:  # pragma: no cover - surfaced as HTTP error in tests
        raise HTTPException(status_code=500, detail=str(exc))
