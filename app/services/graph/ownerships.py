from typing import Dict, Any
from app.db.neo4j_connector import run_cypher


def create_ownership(owner_id: str, owned_id: str, stake: float = None) -> Dict[str, Any]:
    query = (
        "MATCH (a:Entity {id: $owner}), (b:Entity {id: $owned}) "
        "MERGE (a)-[r:OWNS]->(b) "
        "SET r.stake = $stake "
        "RETURN a.id AS owner, b.id AS owned, r.stake AS stake"
    )
    res = run_cypher(query, {"owner": owner_id, "owned": owned_id, "stake": stake})
    return res[0] if res else {}
