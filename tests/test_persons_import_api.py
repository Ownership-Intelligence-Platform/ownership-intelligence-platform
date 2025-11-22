import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.graph_service import get_person_extended


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_persons_import_endpoint(client):
    path = os.path.join("data", "persons.csv")
    assert os.path.isfile(path)
    resp = client.post("/persons/import", json={})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "persons" in data
    assert data["persons"]["upserted"] >= 2
    ext = get_person_extended("P2001")
    assert ext.get("risk_profile") is not None
    assert isinstance(ext["risk_profile"].get("composite_risk_score"), float)
