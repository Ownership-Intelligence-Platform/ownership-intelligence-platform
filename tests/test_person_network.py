import types
import pytest

from app.services.graph.person_network import get_person_network


class FakeRunner:
    def __init__(self):
        self.calls = []

    def __call__(self, query: str, params: dict | None = None):
        self.calls.append((query, params))
        # Route by query intent
        if "RETURN p.id AS id, p.name AS name" in query:
            # focal person
            if params and params.get("id") == "P1":
                return [{"id": "P1", "name": "Li Wei", "type": "Person"}]
            return []
        if "OPTIONAL MATCH (p0)-[r:LEGAL_REP|SERVES_AS]->(c:Entity)" in query:
            # companies + direct links
            return [{
                "companies": [
                    {"id": "C1", "name": "Acme Holdings Ltd", "type": "Company"},
                ],
                "links": [
                    {"from": "P1", "to": "C1", "type": "SERVES_AS", "role": "Chairman"},
                ],
            }]
        if "<-[r:LEGAL_REP|SERVES_AS]-(p:Entity)" in query:
            # other persons via same companies
            return [{
                "persons": [
                    {"id": "P2", "name": "Wang Fang", "type": "Person"},
                ],
                "links": [
                    {"from": "P2", "to": "C1", "type": "SERVES_AS", "role": "CFO"},
                ],
                "shared": [
                    {"a": "P1", "b": "P2", "company": "C1"},
                ],
            }]
        return []


def test_get_person_network_builds_nodes_and_links(monkeypatch):
    fake = FakeRunner()
    monkeypatch.setattr("app.services.graph.person_network.run_cypher", fake)

    graph = get_person_network("P1")

    assert graph["person"]["id"] == "P1"
    node_ids = {n["id"] for n in graph["nodes"]}
    assert {"P1", "P2", "C1"}.issubset(node_ids)

    # expect at least 1 direct link and 1 shared link
    types = {l["type"] for l in graph["links"]}
    assert "SERVES_AS" in types
    assert "SHARE_COMPANY" in types
