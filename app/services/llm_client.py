"""LLM client wrapper for OpenAI-compatible endpoints.

Supports Alibaba DashScope (Qwen) or any OpenAI-compatible base_url.

Configuration via environment variables:

- LLM_API_KEY / OPENAI_API_KEY / DASHSCOPE_API_KEY
- LLM_BASE_URL (e.g., https://dashscope.aliyuncs.com/compatible-mode/v1)
- LLM_MODEL (default: qwen-plus)

Usage:
    from app.services.llm_client import get_llm_client
    client = get_llm_client()
    text, usage, model = client.generate([
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Say hi"},
    ])
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Tuple

try:
    from openai import OpenAI
except Exception as _exc:  # pragma: no cover - import checked at runtime
    OpenAI = None
    _openai_import_error = _exc


class LLMClient:
    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 20.0,
    ) -> None:
        if OpenAI is None:  # pragma: no cover
            raise RuntimeError(
                "The 'openai' package is not installed. Install with: pip install openai"
                f"\nImport error: {_openai_import_error!r}"
            )
        self.api_key = api_key or os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("DASHSCOPE_API_KEY")
        if not self.api_key:
            raise RuntimeError("Missing LLM API key. Set LLM_API_KEY or OPENAI_API_KEY or DASHSCOPE_API_KEY.")

        # If DASHSCOPE key present and no explicit base_url, default to DashScope compatible endpoint.
        default_dashscope_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
        self.base_url = base_url or os.getenv("LLM_BASE_URL") or (default_dashscope_url if os.getenv("DASHSCOPE_API_KEY") else None)
        self.model = model or os.getenv("LLM_MODEL") or "qwen-plus"
        self.timeout = timeout

        # Create client (OpenAI-compatible)
        if self.base_url:
            self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        else:
            self._client = OpenAI(api_key=self.api_key)

    def generate(
        self,
        messages: List[Dict[str, Any]],
        *,
        temperature: float = 0.2,
        max_tokens: int = 1200,
        extra_body: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
    ) -> Tuple[str, Dict[str, Any], str]:
        """Generate a chat completion and return (text, usage, model).

        extra_body: provider-specific extensions (e.g., {"enable_thinking": False} for some Qwen variants)
        """
        payload: Dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "temperature": float(temperature),
            "max_tokens": int(max_tokens),
        }
        if extra_body:
            payload.update({"extra_body": extra_body})

        try:
            # Pass explicit request timeout to the underlying client when supported.
            resp = self._client.chat.completions.create(**payload, request_timeout=self.timeout)
        except TypeError:
            # Some client versions may not accept request_timeout on this call; fall back without it.
            resp = self._client.chat.completions.create(**payload)
        text = (resp.choices[0].message.content or "").strip() if resp.choices else ""
        usage = getattr(resp, "usage", None)
        usage_dict = usage.model_dump() if hasattr(usage, "model_dump") else (usage or {})
        return text, usage_dict, getattr(resp, "model", payload["model"]) or payload["model"]

    def embed(self, texts: list[str], *, model: Optional[str] = None) -> list[list[float]]:
        """Return embeddings for a list of input strings.

        Uses the OpenAI-compatible embeddings endpoint when available. The embeddings
        model can be overridden with the LLM_EMBED_MODEL environment variable or the
        `model` argument.
        """
        # Determine embedding model (env override allowed)
        embed_model = model or os.getenv("LLM_EMBED_MODEL") or "text-embedding-3-small"
        # Some OpenAI-compatible clients expose embeddings on `.embeddings.create`
        try:
            # Prefer to pass an explicit request timeout when available on the client.
            try:
                resp = self._client.embeddings.create(model=embed_model, input=texts, request_timeout=self.timeout)
            except TypeError:
                resp = self._client.embeddings.create(model=embed_model, input=texts)
        except Exception as exc:  # pragma: no cover - runtime dependent
            raise RuntimeError(f"Embedding request failed: {exc}")
        # Response shape: data: [{embedding: [...]}, ...]
        data = getattr(resp, "data", None) or []
        embeddings: list[list[float]] = []
        for item in data:
            vec = item.get("embedding") if isinstance(item, dict) else getattr(item, "embedding", None)
            if vec is None:
                # Try attribute access for client-lib typed objects
                try:
                    vec = item.embedding  # type: ignore
                except Exception:
                    vec = None
            embeddings.append(vec or [])
        return embeddings


_client_cache: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    global _client_cache
    if _client_cache is None:
        _client_cache = LLMClient()
    return _client_cache
