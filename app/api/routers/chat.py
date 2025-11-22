from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.llm_client import get_llm_client
from app.services.query_parser_service import parse_person_query
from app.services.graph_rag import resolve_graphrag


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
    # Optional: enable smart person/entity resolution via graphRAG
    use_person_resolver: Optional[bool] = False


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

        # Optional: run person/entity resolver to attach structured candidates
        resolver_result = None
        if req.use_person_resolver:
            try:
                parsed = parse_person_query(req.message)
                extra = {
                    "gender": parsed.get("gender"),
                    "address_keywords": parsed.get("address_keywords"),
                    "id_number_tail": parsed.get("id_number_tail"),
                }
                resolver_result = resolve_graphrag(
                    name=parsed.get("name"),
                    birth_date=parsed.get("birth_date"),
                    extra=extra,
                    use_semantic=True,
                    top_k=5,
                )
                # Prepend a short system hint with structured resolver outcome for the LLM
                if resolver_result.get("candidates"):
                    summary_lines = []
                    for c in resolver_result["candidates"]:
                        summary_lines.append(
                            f"- id={c.get('node_id')} name={c.get('name')} score={c.get('score'):.2f}"
                        )
                    resolver_context = (
                        "系统内的图谱检索为本次查询找到如下候选实体：\n" + "\n".join(summary_lines) +
                        "\n你可以参考这些候选和它们的网络关系来回答用户的问题。"
                    )
                    messages.insert(0, {"role": "system", "content": resolver_context})
            except Exception:
                resolver_result = None

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
        if resolver_result is not None:
            resp["person_resolver"] = resolver_result
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
