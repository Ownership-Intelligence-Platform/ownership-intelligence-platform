from typing import List, Dict, Any
from app.db.neo4j_connector import run_cypher


def get_equity_penetration(root_id: str, depth: int = 3) -> Dict[str, Any]:
    """Compute equity penetration (look-through ownership) from root to descendants.

    Penetration for a target node along a path is the product of stakes on the path
    treating stake as a percentage (0-100). When multiple distinct paths exist to the same
    target, their penetrations are summed. Root is excluded (paths are length >= 1).

    Returns a dict with root info (if it exists) and an items list sorted by penetration desc.
    """
    root_res = run_cypher(
        "MATCH (r:Entity {id: $id}) RETURN r.id AS id, r.name AS name, r.type AS type",
        {"id": root_id},
    )
    if not root_res:
        return {}

    query = (
        "MATCH (root:Entity {id: $id}) "
        "OPTIONAL MATCH p = (root)-[:OWNS*1..10]->(n:Entity) "
        "WHERE length(p) <= $depth "
        "WITH n, p "
        "WHERE p IS NOT NULL AND n IS NOT NULL "
        "WITH n, reduce(prod = 1.0, r IN relationships(p) | prod * coalesce(r.stake, 100.0)/100.0) AS pen "
        "RETURN n.id AS id, n.name AS name, n.type AS type, sum(pen) AS penetration "
        "ORDER BY penetration DESC"
    )
    rows = run_cypher(query, {"id": root_id, "depth": depth})

    items: List[Dict[str, Any]] = []
    for r in rows:
        pen_pct = (r.get("penetration") or 0.0) * 100.0
        items.append(
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "type": r.get("type"),
                "penetration": pen_pct,
            }
        )

    root = root_res[0]
    return {"root": {"id": root.get("id"), "name": root.get("name"), "type": root.get("type")}, "items": items}


def get_equity_penetration_with_paths(root_id: str, depth: int = 3, max_paths: int = 3) -> Dict[str, Any]:
    """Compute equity penetration and also return explicit investment paths per target."""
    root_res = run_cypher(
        "MATCH (r:Entity {id: $id}) RETURN r.id AS id, r.name AS name, r.type AS type",
        {"id": root_id},
    )
    if not root_res:
        return {}

    query = (
        "MATCH (root:Entity {id: $id}) "
        "OPTIONAL MATCH p = (root)-[:OWNS*1..10]->(n:Entity) "
        "WHERE length(p) <= $depth "
        "WITH n, p "
        "WHERE p IS NOT NULL AND n IS NOT NULL "
        "WITH n, p, "
        "  reduce(prod = 1.0, r IN relationships(p) | prod * coalesce(r.stake, 100.0)/100.0) AS pen, "
        "  [node IN nodes(p) | {id: node.id, name: node.name, type: node.type}] AS nodes_list, "
        "  [rel IN relationships(p) | {from: startNode(rel).id, to: endNode(rel).id, stake: rel.stake}] AS rels_list "
        "RETURN n.id AS id, n.name AS name, n.type AS type, "
        "       sum(pen) AS penetration, "
        "       collect({nodes: nodes_list, rels: rels_list, path_penetration: pen}) AS paths "
        "ORDER BY penetration DESC"
    )
    rows = run_cypher(query, {"id": root_id, "depth": depth})

    items: List[Dict[str, Any]] = []
    for r in rows:
        pen_pct = ((r.get("penetration") or 0.0) * 100.0)
        paths = r.get("paths") or []
        paths_sorted = sorted(paths, key=lambda x: (x.get("path_penetration") or 0.0), reverse=True)
        top_paths = []
        for p in paths_sorted[: max(0, int(max_paths or 0))]:
            pp = (p.get("path_penetration") or 0.0) * 100.0
            top_paths.append({"nodes": p.get("nodes") or [], "rels": p.get("rels") or [], "path_penetration": pp})
        items.append(
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "type": r.get("type"),
                "penetration": pen_pct,
                "paths": top_paths,
            }
        )

    root = root_res[0]
    return {"root": {"id": root.get("id"), "name": root.get("name"), "type": root.get("type")}, "items": items}
