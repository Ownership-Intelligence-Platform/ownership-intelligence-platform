from typing import Dict, Any, List
from app.db.neo4j_connector import run_cypher


def create_guarantee(guarantor_id: str, guaranteed_id: str, amount: float) -> Dict[str, Any]:
    """Create or update a GUARANTEES relationship with amount."""
    query = (
        "MERGE (g:Entity {id: $guarantor}) "
        "MERGE (b:Entity {id: $guaranteed}) "
        "MERGE (g)-[r:GUARANTEES]->(b) "
        "SET r.amount = $amount "
        "RETURN g.id AS guarantor, b.id AS guaranteed, r.amount AS amount"
    )
    res = run_cypher(query, {"guarantor": guarantor_id, "guaranteed": guaranteed_id, "amount": amount})
    return res[0] if res else {}


def get_guarantees(entity_id: str, direction: str = "out") -> List[Dict[str, Any]]:
    """Return guarantee relationships related to an entity."""
    direction = (direction or "out").lower()
    if direction == "in":
        query = (
            "MATCH (g:Entity)-[r:GUARANTEES]->(b:Entity {id: $id}) "
            "RETURN g.id AS guarantor_id, b.id AS guaranteed_id, r.amount AS amount "
            "ORDER BY coalesce(r.amount, 0) DESC"
        )
    elif direction == "both":
        query = (
            "MATCH (g:Entity)-[r:GUARANTEES]->(b:Entity) "
            "WHERE g.id = $id OR b.id = $id "
            "RETURN g.id AS guarantor_id, b.id AS guaranteed_id, r.amount AS amount "
            "ORDER BY coalesce(r.amount, 0) DESC"
        )
    else:
        query = (
            "MATCH (g:Entity {id: $id})-[r:GUARANTEES]->(b:Entity) "
            "RETURN g.id AS guarantor_id, b.id AS guaranteed_id, r.amount AS amount "
            "ORDER BY coalesce(r.amount, 0) DESC"
        )
    rows = run_cypher(query, {"id": entity_id})
    return rows or []
