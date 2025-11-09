from typing import Dict, Any
from app.db.neo4j_connector import run_cypher


def get_layers(root_id: str, depth: int = 1) -> Dict[str, Any]:
    """Return nodes and paths from root outgoing OWNS up to depth.

    Neo4j does not allow parameters/variables inside the variable-length pattern bound,
    so we use a safe fixed upper bound (e.g., 10) and then filter by length(p) <= $depth.
    """
    query = (
        "MATCH (root:Entity {id: $id}) "
        "OPTIONAL MATCH p = (root)-[:OWNS*1..10]->(n:Entity) "
        "WHERE length(p) <= $depth "
        "WITH root, collect(p) AS paths "
        "UNWIND paths AS p "
        "WITH root, p WHERE p IS NOT NULL "
        "WITH root, p, [node IN nodes(p) | {id: node.id, name: node.name, type: node.type}] AS nodes_list, "
        "[rel IN relationships(p) | {from: startNode(rel).id, to: endNode(rel).id, stake: rel.stake}] AS rels_list "
        "RETURN root.id AS root_id, root.name AS root_name, root.type AS root_type, collect({nodes: nodes_list, rels: rels_list}) AS layers"
    )
    res = run_cypher(query, {"id": root_id, "depth": depth})
    if not res:
        # If no paths, still try to return root basic info
        q2 = "MATCH (r:Entity {id: $id}) RETURN r.id AS root_id, r.name AS root_name, r.type AS root_type"
        r2 = run_cypher(q2, {"id": root_id})
        if r2:
            return {"root": {"id": r2[0].get("root_id"), "name": r2[0].get("root_name"), "type": r2[0].get("root_type")}, "layers": []}
        return {"root": {"id": root_id}, "layers": []}

    row = res[0]
    return {
        "root": {"id": row.get("root_id"), "name": row.get("root_name"), "type": row.get("root_type")},
        "layers": row.get("layers") or [],
    }
