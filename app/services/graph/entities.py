from typing import List, Dict, Any, Optional
from app.db.neo4j_connector import run_cypher


def create_entity(entity_id: str, name: str = None, type_: str = None, description: Optional[str] = None) -> Dict[str, Any]:
    """Create or update an Entity node without clobbering existing properties with nulls.

    Behavior:
    - If the node doesn't exist, it will be created; provided non-null name/type/description are set.
    - If the node exists, only overwrite properties when non-null values are provided.
    """
    query = (
        "MERGE (e:Entity {id: $id}) "
        "SET e.name = coalesce($name, e.name), "
        "    e.type = coalesce($type, e.type), "
        "    e.description = coalesce($description, e.description) "
        "RETURN e.id AS id, e.name AS name, e.type AS type, e.description AS description"
    )
    res = run_cypher(query, {"id": entity_id, "name": name, "type": type_, "description": description})
    return res[0] if res else {}


def get_entity(entity_id: str) -> Dict[str, Any]:
    """Fetch a single Entity by id. Returns empty dict if not found."""
    q = "MATCH (e:Entity {id: $id}) RETURN e.id AS id, e.name AS name, e.type AS type, e.description AS description"
    res = run_cypher(q, {"id": entity_id})
    return res[0] if res else {}


def find_entities_by_name_exact(name: str) -> List[Dict[str, Any]]:
    """Return entities whose name matches exactly (case-insensitive).

    We match on toLower(e.name) = toLower($name) to avoid case issues, and
    return a minimal shape used by resolvers/UI.
    """
    if not name:
        return []
    q = (
        "MATCH (e:Entity) "
        "WHERE toLower(e.name) = toLower($name) "
        "RETURN e.id AS id, e.name AS name, e.type AS type, e.description AS description "
        "ORDER BY coalesce(e.type, ''), e.id"
    )
    return run_cypher(q, {"name": name}) or []


def search_entities_fuzzy(q: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Fuzzy search entities by partial name or id.

    Strategy:
    - Case-insensitive containment match on name OR id.
    - Compute a simple score: startswith match gets +2, contains gets +1.
    - Order by score desc, then shorter name, then id.
    - Return id, name, type and score.

    NOTE: Neo4j doesn't have native full-text here (unless indexes configured); this
    uses toLower + CONTAINS / STARTS WITH for a lightweight approach.
    """
    q_norm = (q or "").strip()
    if not q_norm:
        return []
    # We perform two passes: startswith and contains, then union distinct.
    cypher = (
        "MATCH (e:Entity) "
        "WHERE toLower(e.name) STARTS WITH toLower($q) OR toLower(e.id) STARTS WITH toLower($q) "
        "WITH e, 2 AS baseScore "
        "RETURN e.id AS id, e.name AS name, e.type AS type, e.description AS description, baseScore AS score "
        "UNION "
        "MATCH (e:Entity) "
        "WHERE (toLower(e.name) CONTAINS toLower($q) OR toLower(e.id) CONTAINS toLower($q)) "
        "AND NOT (toLower(e.name) STARTS WITH toLower($q) OR toLower(e.id) STARTS WITH toLower($q)) "
        "WITH e, 1 AS baseScore "
        "RETURN e.id AS id, e.name AS name, e.type AS type, e.description AS description, baseScore AS score"
    )
    rows = run_cypher(cypher, {"q": q_norm}) or []

    def sort_key(r: Dict[str, Any]):
        name = (r.get("name") or "")
        return (-int(r.get("score") or 0), len(name), name.lower(), r.get("id"))

    rows_sorted = sorted(rows, key=sort_key)[: limit]
    return rows_sorted


def resolve_entity_identifier(identifier: str) -> Dict[str, Any]:
    """Resolve a user-provided identifier to a single entity.

    Resolution strategy:
    - If an Entity with id == identifier exists, return it (by='id').
    - Else, match by exact name (case-insensitive). If exactly one match, return it (by='name').
    - If multiple exact-name matches, return {ambiguous: True, matches: [...]}.
    - If none, return {}.
    """
    if not identifier:
        return {}
    # Prefer id match
    ent = get_entity(identifier)
    if ent:
        return {"resolved": ent, "by": "id", "ambiguous": False}
    # Fallback: exact name (case-insensitive)
    matches = find_entities_by_name_exact(identifier)
    if len(matches) == 1:
        return {"resolved": matches[0], "by": "name", "ambiguous": False}
    if len(matches) > 1:
        return {"resolved": None, "by": "name", "ambiguous": True, "matches": matches}
    # Fallback: fuzzy search; if exactly one reasonable match, accept it
    fuzzy = search_entities_fuzzy(identifier, limit=5)
    if len(fuzzy) == 1:
        return {"resolved": fuzzy[0], "by": "fuzzy", "ambiguous": False}
    if len(fuzzy) > 1:
        return {"resolved": None, "by": "fuzzy", "ambiguous": True, "matches": fuzzy}
    return {}
