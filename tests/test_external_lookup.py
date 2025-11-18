from fastapi.testclient import TestClient

from app.main import app


def test_external_lookup_basic():
    client = TestClient(app)
    resp = client.get("/external/lookup", params={"name": "张三", "birthdate": "1990-01-02"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["source"] == "external"
    assert data["query"]["name"] == "张三"
    assert data["query"]["birthdate"] == "1990-01-02"
    assert isinstance(data.get("providers"), list) and len(data["providers"]) >= 1
    # providers content shape
    p0 = data["providers"][0]
    assert "name" in p0 and "matches" in p0


def test_external_lookup_requires_name():
    client = TestClient(app)
    resp = client.get("/external/lookup", params={"name": ""})
    # FastAPI will 422 on empty name, or service may 400
    assert resp.status_code in (400, 422)
