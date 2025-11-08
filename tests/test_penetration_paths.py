import pytest

from app.services.graph_service import (
    create_entity,
    create_ownership,
    get_equity_penetration_with_paths,
)

# NOTE: This test uses the real graph_service functions, which require a Neo4j backend.
# To run it offline, you would inject fakes or mock run_cypher. Here we mark it as skipped
# unless an environment variable TEST_NEO4J is set.

import os

def neo4j_available():
    return os.getenv("TEST_NEO4J") == "1"

@pytest.mark.skipif(not neo4j_available(), reason="Neo4j not available for integration test")
def test_penetration_with_paths_basic():
    # Create a tiny ownership chain: A -> B (50%), A -> C (40%), B -> C (30%)
    create_entity("A", "Alpha", "Company")
    create_entity("B", "Beta", "Company")
    create_entity("C", "Gamma", "Company")
    create_ownership("A", "B", 50.0)
    create_ownership("A", "C", 40.0)
    create_ownership("B", "C", 30.0)

    result = get_equity_penetration_with_paths("A", depth=3, max_paths=5)
    items = {i["id"]: i for i in result.get("items", [])}
    assert "C" in items
    # Penetration paths to C: direct 40%, indirect 50% * 30% = 15%, total 55%
    assert pytest.approx(items["C"]["penetration"], rel=1e-3) == 55.0
    # Should list at least the two paths
    assert len(items["C"]["paths"]) >= 2
