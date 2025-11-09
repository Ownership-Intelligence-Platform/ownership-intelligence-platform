from typing import Dict, Any
from app.db.neo4j_connector import run_cypher


def create_location_links(
    entity_id: str,
    registered: str | None = None,
    operating: str | None = None,
    offshore: str | None = None,
) -> Dict[str, Any]:
    """Attach location nodes to an entity via REGISTERED_IN / OPERATES_IN / OFFSHORE_IN."""
    query = (
        "MERGE (e:Entity {id: $id}) "
        "FOREACH (_ IN CASE WHEN $registered IS NULL OR $registered = '' THEN [] ELSE [1] END | "
        "  MERGE (r:Location {name: $registered}) "
        "  MERGE (e)-[:REGISTERED_IN]->(r) ) "
        "FOREACH (_ IN CASE WHEN $operating IS NULL OR $operating = '' THEN [] ELSE [1] END | "
        "  MERGE (op:Location {name: $operating}) "
        "  MERGE (e)-[:OPERATES_IN]->(op) ) "
        "FOREACH (_ IN CASE WHEN $offshore IS NULL OR $offshore = '' THEN [] ELSE [1] END | "
        "  MERGE (of:Location {name: $offshore}) "
        "  MERGE (e)-[:OFFSHORE_IN]->(of) ) "
        "RETURN e.id AS id"
    )
    res = run_cypher(
        query,
        {"id": entity_id, "registered": registered, "operating": operating, "offshore": offshore},
    )
    return res[0] if res else {}


def get_locations(entity_id: str) -> Dict[str, Any]:
    """Return locations linked to an entity, grouped by relationship type."""
    query = (
        "MATCH (e:Entity {id: $id}) "
        "OPTIONAL MATCH (e)-[:REGISTERED_IN]->(r:Location) "
        "OPTIONAL MATCH (e)-[:OPERATES_IN]->(op:Location) "
        "OPTIONAL MATCH (e)-[:OFFSHORE_IN]->(of:Location) "
        "RETURN collect(DISTINCT r.name) AS registered, "
        "       collect(DISTINCT op.name) AS operating, "
        "       collect(DISTINCT of.name) AS offshore"
    )
    res = run_cypher(query, {"id": entity_id})
    if not res:
        return {"registered": [], "operating": [], "offshore": []}
    row = res[0]

    def _clean(xs):
        return [x for x in (xs or []) if x]

    return {
        "registered": _clean(row.get("registered")),
        "operating": _clean(row.get("operating")),
        "offshore": _clean(row.get("offshore")),
    }
