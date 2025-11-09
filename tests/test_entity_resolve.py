import os
import pytest

from app.services.graph_service import create_entity, resolve_entity_identifier

# Integration-style tests require Neo4j; skip unless TEST_NEO4J=1
neo4j_enabled = os.getenv("TEST_NEO4J") == "1"

pytestmark = pytest.mark.skipif(not neo4j_enabled, reason="Neo4j not available for entity resolve integration test")


def test_resolve_by_id():
    create_entity("R1", "ResolveCo", "Company")
    res = resolve_entity_identifier("R1")
    assert res.get("by") == "id"
    assert res.get("resolved", {}).get("id") == "R1"


def test_resolve_by_name_exact():
    create_entity("R2", "UniqueNameCo", "Company")
    res = resolve_entity_identifier("UniqueNameCo")
    assert res.get("by") == "name"
    assert res.get("resolved", {}).get("id") == "R2"


def test_resolve_ambiguous_name():
    create_entity("R3A", "DupNameCo", "Company")
    create_entity("R3B", "DupNameCo", "Holding")
    res = resolve_entity_identifier("DupNameCo")
    assert res.get("ambiguous") is True
    matches = res.get("matches") or []
    assert len(matches) >= 2
