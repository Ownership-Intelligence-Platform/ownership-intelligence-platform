from typing import Dict, Any, List
from app.db.neo4j_connector import run_cypher


def create_transaction(
    from_id: str,
    to_id: str,
    amount: float,
    time: str | None = None,
    tx_type: str | None = None,
    channel: str | None = None,
) -> Dict[str, Any]:
    """Create a Transaction node between two entities."""
    query = (
        "MERGE (a:Entity {id: $from}) "
        "MERGE (b:Entity {id: $to}) "
        "CREATE (t:Transaction {amount: $amount, time: $time, type: $type, channel: $channel}) "
        "MERGE (a)-[:INITIATES]->(t) "
        "MERGE (t)-[:TO]->(b) "
        "RETURN t.amount AS amount, t.time AS time, t.type AS type, t.channel AS channel"
    )
    res = run_cypher(
        query,
        {"from": from_id, "to": to_id, "amount": amount, "time": time, "type": tx_type, "channel": channel},
    )
    return res[0] if res else {}


def get_transactions(entity_id: str, direction: str = "out") -> List[Dict[str, Any]]:
    """Return transactions related to an entity (INITIATES / TO)."""
    direction = (direction or "out").lower()
    if direction == "in":
        query = (
            "MATCH (from:Entity)-[:INITIATES]->(t:Transaction)-[:TO]->(to:Entity {id: $id}) "
            "RETURN from.id AS from_id, to.id AS to_id, t.amount AS amount, t.time AS time, t.type AS type, t.channel AS channel "
            "ORDER BY coalesce(t.time, '') DESC"
        )
    elif direction == "both":
        query = (
            "MATCH (from:Entity)-[:INITIATES]->(t:Transaction)-[:TO]->(to:Entity) "
            "WHERE from.id = $id OR to.id = $id "
            "RETURN from.id AS from_id, to.id AS to_id, t.amount AS amount, t.time AS time, t.type AS type, t.channel AS channel "
            "ORDER BY coalesce(t.time, '') DESC"
        )
    else:  # out
        query = (
            "MATCH (from:Entity {id: $id})-[:INITIATES]->(t:Transaction)-[:TO]->(to:Entity) "
            "RETURN from.id AS from_id, to.id AS to_id, t.amount AS amount, t.time AS time, t.type AS type, t.channel AS channel "
            "ORDER BY coalesce(t.time, '') DESC"
        )
    rows = run_cypher(query, {"id": entity_id})
    return rows or []
