from fastapi.testclient import TestClient

from app.main import app


class _FakeLLM:
    def generate(self, messages, *, temperature=0.2, max_tokens=600, extra_body=None, model=None):
        # Simple echo behavior for tests: reply with last user message prefixed
        last_user = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
        return f"Echo: {last_user}", {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3}, model or "fake-model"


def test_chat_endpoint_monkeypatched(monkeypatch):
    # Monkeypatch get_llm_client used inside the router to avoid importing real openai
    from app.api.routers import chat as chat_router

    def _fake_get_llm_client():
        return _FakeLLM()

    monkeypatch.setattr(chat_router, "get_llm_client", _fake_get_llm_client)

    client = TestClient(app)
    resp = client.post("/chat", json={"message": "Hello"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["reply"].startswith("Echo: Hello")
    assert data["model"] == "fake-model"
    assert "usage" in data
