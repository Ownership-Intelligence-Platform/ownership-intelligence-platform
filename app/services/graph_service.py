from typing import List, Dict, Any, Optional
from app.db.neo4j_connector import run_cypher


def create_entity(entity_id: str, name: str = None, type_: str = None) -> Dict[str, Any]:
    """Create or update an Entity node without clobbering existing properties with nulls.

    Behavior:
    - If the node doesn't exist, it will be created; provided non-null name/type are set.
    - If the node exists, only overwrite properties when non-null values are provided.
    """
    query = (
        "MERGE (e:Entity {id: $id}) "
        "SET e.name = coalesce($name, e.name), "
        "    e.type = coalesce($type, e.type) "
        "RETURN e.id AS id, e.name AS name, e.type AS type"
    )
    res = run_cypher(query, {"id": entity_id, "name": name, "type": type_})
    return res[0] if res else {}


def create_ownership(owner_id: str, owned_id: str, stake: float = None) -> Dict[str, Any]:
    query = (
        "MATCH (a:Entity {id: $owner}), (b:Entity {id: $owned}) "
        "MERGE (a)-[r:OWNS]->(b) "
        "SET r.stake = $stake "
        "RETURN a.id AS owner, b.id AS owned, r.stake AS stake"
    )
    res = run_cypher(query, {"owner": owner_id, "owned": owned_id, "stake": stake})
    return res[0] if res else {}


def get_layers(root_id: str, depth: int = 1) -> Dict[str, Any]:
    # Return nodes and paths from root outgoing OWNS up to depth.
    # Neo4j does not allow parameters/variables inside the variable-length pattern bound,
    # so we use a safe fixed upper bound (e.g., 10) and then filter by length(p) <= $depth.
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


def get_equity_penetration(root_id: str, depth: int = 3) -> Dict[str, Any]:
    """Compute equity penetration (look-through ownership) from root to descendants.

    Penetration for a target node along a path is the product of stakes on the path
    treating stake as a percentage (0-100). When multiple distinct paths exist to the same
    target, their penetrations are summed. Root is excluded (paths are length >= 1).

    Returns a dict with root info (if it exists) and an items list sorted by penetration desc.
    """
    # First, confirm root exists and fetch basic info
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
        # Convert to percentage (0-100)
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


def clear_database() -> Dict[str, Any]:
    """Delete all nodes and relationships from the Neo4j database.

    Returns a small stats dict with counts observed before deletion.
    """
    # Collect counts before deletion (best-effort stats)
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

    # Perform deletion
    run_cypher("MATCH (n) DETACH DELETE n")

    return {"deleted_nodes": nodes_before, "deleted_relationships": rels_before}


def create_legal_rep(company_id: str, person_id: str, role: Optional[str] = None) -> Dict[str, Any]:
    """Create or update a LEGAL_REP relationship from a Person to a Company.

    We don't strictly enforce labels beyond :Entity; role is optional text.
    """
    query = (
        "MATCH (c:Entity {id: $company}), (p:Entity {id: $person}) "
        "MERGE (p)-[r:LEGAL_REP]->(c) "
        "SET r.role = $role "
        "RETURN p.id AS person_id, c.id AS company_id, r.role AS role"
    )
    res = run_cypher(query, {"company": company_id, "person": person_id, "role": role})
    return res[0] if res else {}


def get_representatives(company_id: str) -> Dict[str, Any]:
    """Return company basic info and its legal representatives (if any)."""
    query = (
        "MATCH (c:Entity {id: $id}) "
        "OPTIONAL MATCH (p:Entity)-[r:LEGAL_REP]->(c) "
        "RETURN c.id AS id, c.name AS name, c.type AS type, "
        "collect({id: p.id, name: p.name, type: p.type, role: r.role}) AS representatives"
    )
    res = run_cypher(query, {"id": company_id})
    if not res:
        return {}
    row = res[0]
    reps = [x for x in (row.get("representatives") or []) if x.get("id")]
    return {
        "company": {"id": row.get("id"), "name": row.get("name"), "type": row.get("type")},
        "representatives": reps,
    }
