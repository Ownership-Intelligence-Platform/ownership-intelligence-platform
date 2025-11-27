import pytest
from app.services.graph_service import create_or_update_person_extended
from app.api.routers.entities import api_suggest_entities


def test_suggest_returns_enriched_person(monkeypatch):
    # Upsert an extended person
    create_or_update_person_extended(
        person_id="P_TEST_ENRICHED",
        name="李辉扩展",
        type_="Person",
        basic_info={"nationality": "中国", "birth_date": "1990-05-12"},
        kyc_info={"kyc_status": "approved", "kyc_risk_level": "medium", "watchlist_hits": 1},
        risk_profile={"composite_risk_score": 42.0, "negative_news_count": 0},
        network_info={"relationship_density_score": 0.55},
        geo_profile={"primary_country": "中国"},
        provenance={"crawler_confidence_score": 0.87},
    )

    resp = api_suggest_entities(q="李辉扩展", limit=5)
    items = resp.get("items") or []
    target = next((it for it in items if it.get("id") == "P_TEST_ENRICHED"), None)
    assert target is not None, f"Enriched person not found in suggestions: {items}"
    # Validate enriched fields present
    assert isinstance(target.get("basic_info"), dict), "basic_info missing or not a dict"
    assert isinstance(target.get("kyc_info"), dict), "kyc_info missing or not a dict"
    assert isinstance(target.get("risk_profile"), dict), "risk_profile missing or not a dict"
    assert target["risk_profile"].get("composite_risk_score") == 42.0
    assert target["kyc_info"].get("watchlist_hits") == 1
