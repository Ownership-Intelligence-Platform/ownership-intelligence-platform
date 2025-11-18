from fastapi.testclient import TestClient

from app.main import app


class _FakeLLM:
    def generate(self, messages, *, temperature=0.2, max_tokens=600, extra_body=None, model=None):
        # Return a deterministic JSON with a couple of variants
        text = (
            '{"canonical": "张三", "variants": '
            '['
            '{"value": "Zhang San", "type": "pinyin", "locale": "en", "confidence": 0.95},'
            '{"value": "Zhangsan", "type": "spacing", "locale": "en", "confidence": 0.6}'
            ']'
            '}'
        )
        return text, {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3}, model or "fake-model"


def test_expand_endpoint(monkeypatch):
    # Monkeypatch get_llm_client used inside the variant service
    import app.services.name_variant_service as nvs

    def _fake_get_llm_client():
        return _FakeLLM()

    monkeypatch.setattr(nvs, "get_llm_client", _fake_get_llm_client)

    client = TestClient(app)
    resp = client.post("/screening/expand", json={"name": "张三"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["canonical"] == "张三"
    assert any(v["value"] == "Zhang San" for v in data["variants"])  # includes pinyin variant
    assert data.get("model") == "fake-model"


def test_name_scan_includes_variants(monkeypatch):
    # Monkeypatch again for name-scan enrichment
    import app.services.name_variant_service as nvs

    def _fake_get_llm_client():
        return _FakeLLM()

    monkeypatch.setattr(nvs, "get_llm_client", _fake_get_llm_client)

    client = TestClient(app)
    resp = client.get("/name-scan", params={"q": "张三"})
    assert resp.status_code == 200
    data = resp.json()
    ve = data.get("variant_expansion")
    assert ve and ve.get("canonical") == "张三"
    assert any(v["value"] == "Zhang San" for v in ve.get("variants", []))
