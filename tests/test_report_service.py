import os
import tempfile
from pathlib import Path

from app.services.report_service import generate_cdd_report


def test_generate_cdd_report_fallback(monkeypatch):
    """When no LLM key is provided, the service should produce a fallback report."""
    # Ensure no API key so LLM call fails gracefully
    for k in ["LLM_API_KEY", "OPENAI_API_KEY", "DASHSCOPE_API_KEY"]:
        monkeypatch.delenv(k, raising=False)

    # Monkeypatch bundle builder dependencies to minimal deterministic data
    from app.services import graph_service
    from app.services import risk_service
    from app.services import news_service

    def fake_get_entity(eid):
        if eid != "TEST_ENT":
            return None
        return {"id": eid, "name": "Test Entity", "type": "Company", "description": "A test entity."}

    def fake_get_equity_penetration(eid, depth):
        return {"entity_id": eid, "depth": depth, "layers": []}

    def fake_analyze_entity_risks(eid, news_limit=10):
        return {"summary": {"total_items": 0, "total_risky_items": 0, "overall_risk_score": 0}}

    def fake_get_company_news(name, limit=10):
        return []

    def fake_get_stored_news(eid):
        return []

    monkeypatch.setattr(graph_service, "get_entity", fake_get_entity)
    monkeypatch.setattr(graph_service, "get_equity_penetration", fake_get_equity_penetration)
    monkeypatch.setattr(risk_service, "analyze_entity_risks", fake_analyze_entity_risks)
    monkeypatch.setattr(news_service, "get_company_news", fake_get_company_news)
    monkeypatch.setattr(graph_service, "get_stored_news", fake_get_stored_news)

    result = generate_cdd_report("TEST_ENT", refresh=True)
    assert result.get("entity_id") == "TEST_ENT"
    assert "Manual Review recommended" in result.get("content", "")
    assert Path(result.get("path")).is_file()


def test_generate_cdd_report_html_fallback(monkeypatch):
    # No keys so we force fallback path
    for k in ["LLM_API_KEY", "OPENAI_API_KEY", "DASHSCOPE_API_KEY"]:
        monkeypatch.delenv(k, raising=False)

    from app.services import graph_service
    from app.services import risk_service
    from app.services import news_service

    def fake_get_entity(eid):
        return {"id": eid, "name": "Test Entity"}

    monkeypatch.setattr(graph_service, "get_entity", fake_get_entity)
    monkeypatch.setattr(graph_service, "get_equity_penetration", lambda eid, d: {})
    monkeypatch.setattr(risk_service, "analyze_entity_risks", lambda eid, news_limit=10: {"summary": {}})
    monkeypatch.setattr(news_service, "get_company_news", lambda name, limit=10: [])
    monkeypatch.setattr(graph_service, "get_stored_news", lambda eid: [])

    result = generate_cdd_report("ENT_HTML", refresh=True, as_html=True)
    assert result.get("entity_id") == "ENT_HTML"
    assert Path(result.get("path_html")).is_file()
    assert "<html" in result.get("content_html", "") or "CDD Snapshot" in result.get("content_html", "")
