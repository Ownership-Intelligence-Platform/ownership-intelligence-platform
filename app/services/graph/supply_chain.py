from typing import Dict, Any, List
from app.db.neo4j_connector import run_cypher


def create_supply_link(supplier_id: str, customer_id: str, frequency: int | None = None) -> Dict[str, Any]:
    """Create or update a SUPPLIES_TO relationship with frequency."""
    query = (
        "MERGE (s:Entity {id: $supplier}) "
        "MERGE (c:Entity {id: $customer}) "
        "MERGE (s)-[r:SUPPLIES_TO]->(c) "
        "SET r.frequency = $frequency "
        "RETURN s.id AS supplier, c.id AS customer, r.frequency AS frequency"
    )
    res = run_cypher(query, {"supplier": supplier_id, "customer": customer_id, "frequency": frequency})
    return res[0] if res else {}


def get_supply_chain(entity_id: str, direction: str = "out") -> List[Dict[str, Any]]:
    """Return supply chain relationships related to an entity."""
    direction = (direction or "out").lower()
    if direction == "in":
        query = (
            "MATCH (s:Entity)-[r:SUPPLIES_TO]->(c:Entity {id: $id}) "
            "RETURN s.id AS supplier_id, c.id AS customer_id, r.frequency AS frequency "
            "ORDER BY coalesce(r.frequency, 0) DESC"
        )
    elif direction == "both":
        query = (
            "MATCH (s:Entity)-[r:SUPPLIES_TO]->(c:Entity) "
            "WHERE s.id = $id OR c.id = $id "
            "RETURN s.id AS supplier_id, c.id AS customer_id, r.frequency AS frequency "
            "ORDER BY coalesce(r.frequency, 0) DESC"
        )
    else:
        query = (
            "MATCH (s:Entity {id: $id})-[r:SUPPLIES_TO]->(c:Entity) "
            "RETURN s.id AS supplier_id, c.id AS customer_id, r.frequency AS frequency "
            "ORDER BY coalesce(r.frequency, 0) DESC"
        )
    rows = run_cypher(query, {"id": entity_id})
    return rows or []
