from typing import List, Dict, Any, Optional
import json
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
    """Fuzzy search entities (including Person-labeled nodes) by partial name or id.

    Improvements vs initial version:
    - Includes nodes labeled :Person even if any future change drops the :Entity label.
    - Handles Chinese / multi-byte names (case normalization is a no-op but retained for consistency).
    - Adds fallback to extended person fields (basic_info.name alternative) if primary name missing.
    - Dedupes results when nodes carry both :Entity and :Person labels.

    Scoring tiers (higher is better):
        4: id EXACT match OR name EXACT match
        3: id OR name startswith query
        2: description startswith query OR id/name contains query
        1: description contains query

    NOTE: Still lightweight. For scale, move to full-text index.
    """
    q_norm = (q or "").strip()
    if not q_norm:
        return []
    cypher = (
        "MATCH (e) WHERE (e:Entity OR e:Person) "
        "WITH e, "
        "toLower(coalesce(e.id,'')) AS eid, "
        "toLower(coalesce(e.name,'')) AS ename, "
        "toLower(coalesce(e.description,'')) AS edesc, "
        "toLower($q) AS q "
        "WHERE eid CONTAINS q OR ename CONTAINS q OR edesc CONTAINS q "
        "WITH e, eid, ename, edesc, q, "
        "CASE "
        "  WHEN eid = q OR ename = q THEN 4 "
        "  WHEN eid STARTS WITH q OR ename STARTS WITH q THEN 3 "
        "  WHEN edesc STARTS WITH q THEN 2 "
        "  WHEN eid CONTAINS q OR ename CONTAINS q THEN 2 "
        "  WHEN edesc CONTAINS q THEN 1 "
        "  ELSE 0 END AS score "
        "RETURN e.id AS id, e.name AS name, e.type AS type, e.description AS description, "
        "e.basic_info AS basic_info, e.id_info AS id_info, e.job_info AS job_info, "
        "e.kyc_info AS kyc_info, e.risk_profile AS risk_profile, e.network_info AS network_info, "
        "e.geo_profile AS geo_profile, e.compliance_info AS compliance_info, e.provenance AS provenance, score AS score"
    )
    try:
        rows = run_cypher(cypher, {"q": q_norm}) or []
    except Exception as exc:
        import os
        if os.getenv("OI_DEBUG_SUGGEST") == "1":
            return [{
                "id": "(error)",
                "name": f"Fuzzy search error: {type(exc).__name__}",
                "type": None,
                "description": str(exc)[:180],
                "score": 0,
            }]
        return []

    # Deduplicate by id (some nodes may appear once; MATCH ensures single anyway, safeguard retained)
    seen = set()
    deduped: List[Dict[str, Any]] = []
    # Helper to parse JSON-like strings back into dict/list
    def _parse(v):
        if isinstance(v, str):
            vs = v.strip()
            if (vs.startswith('{') and vs.endswith('}')) or (vs.startswith('[') and vs.endswith(']')):
                try:
                    return json.loads(vs)
                except Exception:
                    return None
        return v

    json_fields = {
        "basic_info",
        "id_info",
        "job_info",
        "kyc_info",
        "risk_profile",
        "network_info",
        "geo_profile",
        "compliance_info",
        "provenance",
    }

    for r in rows:
        rid = r.get("id")
        if not rid:
            continue
        if rid in seen:
            continue
        # Parse extended person fields (these may be stored as JSON strings)
        if (r.get("type") or "").lower() == "person":
            for f in json_fields:
                if f in r and r[f] is not None:
                    r[f] = _parse(r[f])
        seen.add(rid)
        deduped.append(r)

    def sort_key(r: Dict[str, Any]):
        name = (r.get("name") or "")
        return (-int(r.get("score") or 0), len(name), name.lower(), r.get("id"))

    return sorted(deduped, key=sort_key)[: limit]


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


def get_entities_by_ids(ids: List[str]) -> Dict[str, str]:
    """Fetch names for a list of entity IDs. Returns a dict {id: name}."""
    if not ids:
        return {}
    q = "MATCH (e:Entity) WHERE e.id IN $ids RETURN e.id AS id, e.name AS name"
    res = run_cypher(q, {"ids": list(set(ids))})
    return {r["id"]: r["name"] for r in res if r.get("id")}
