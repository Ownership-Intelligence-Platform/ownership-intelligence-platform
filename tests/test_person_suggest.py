import pytest
from app.services.graph_service import create_or_update_person_extended
from app.api.routers.entities import api_suggest_entities


def test_suggest_includes_person(monkeypatch):
    # Create a person node
    create_or_update_person_extended(
        person_id="P_TEST_1",
        name="李晨测试",
        type_="Person",
        basic_info={"nationality": "中国"},
        kyc_info={"kyc_status": "approved"},
    )

    # Invoke the suggestion API function directly
    resp = api_suggest_entities(q="李晨测试", limit=5)
    items = resp.get("items") or []
    # Assert at least one item matches our person id
    assert any(it.get("id") == "P_TEST_1" for it in items), f"Person not found in suggestions: {items}"
