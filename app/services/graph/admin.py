from typing import Dict, Any
from app.db.neo4j_connector import run_cypher


def clear_database() -> Dict[str, Any]:
    """Delete all nodes and relationships from the Neo4j database.

    Returns a small stats dict with counts observed before deletion.
    """
    nodes_before = 0
    rels_before = 0
    try:
        nb = run_cypher("MATCH (n) RETURN count(n) AS cnt")
        nodes_before = (nb[0].get("cnt") if nb else 0) or 0
    except Exception:
        pass
    try:
        rb = run_cypher("MATCH ()-[r]-() RETURN count(r) AS cnt")
        rels_before = (rb[0].get("cnt") if rb else 0) or 0
    except Exception:
        pass

    run_cypher("MATCH (n) DETACH DELETE n")

    return {"deleted_nodes": nodes_before, "deleted_relationships": rels_before}
