import types
from fastapi.testclient import TestClient

from app.main import app


class _FakeLLM:
    def generate(self, messages, *, temperature=0.2, max_tokens=600, extra_body=None, model=None):
        last_user = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
        # include a hint to detect that web context was prepended
        has_web = any("web results" in (m.get("content") or "") for m in messages if m.get("role") == "system")
        prefix = "[web] " if has_web else ""
        return f"Echo: {prefix}{last_user}", {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3}, model or "fake-model"


def test_chat_endpoint_with_web_search(monkeypatch):
    # Monkeypatch get_llm_client to fake
    from app.api.routers import chat as chat_router

    def _fake_get_llm_client():
        return _FakeLLM()

    monkeypatch.setattr(chat_router, "get_llm_client", _fake_get_llm_client)

    # Inject a fake web_search_service module to avoid external deps/network
    fake_mod = types.SimpleNamespace()

    class _FakeWS:
        def __init__(self, timeout=6.0, provider="auto"):
            self.timeout = timeout
            self.provider = provider

        def search_and_crawl(self, query: str, k: int = 3):
            return [
                {"title": "T1", "url": "https://example.com/1", "snippet": "s1", "content": "c1"},
                {"title": "T2", "url": "https://example.com/2", "snippet": "s2", "content": "c2"},
            ]

    fake_mod.WebSearch = _FakeWS

    import sys

    monkeypatch.setitem(sys.modules, "app.services.web_search_service", fake_mod)

    client = TestClient(app)
    resp = client.post("/chat", json={"message": "Hello", "use_web": True, "web_provider": "bing"})
    assert resp.status_code == 200
    data = resp.json()
    # Ensure web context impacted the model echo and sources are returned
    assert data["reply"].startswith("Echo: [web] Hello")
    assert isinstance(data.get("sources"), list)
    assert any(s.get("url") == "https://example.com/1" for s in data["sources"]) 
