from typing import Optional, Dict
from app.db.neo4j_connector import run_cypher


ALLOWED_REL_TYPES = {
    # Directed semantics (we'll normalize to an actual relationship type label)
    "PARENT_OF",
    "CHILD_OF",
    "SPOUSE_OF",
    "FRIEND_OF",
    "CLASSMATE_OF",
}


def _ensure_person(person_id: str, name: Optional[str] = None) -> None:
    run_cypher(
        (
            "MERGE (p:Entity {id: $id}) "
            "SET p:Person "
            "SET p.name = coalesce(p.name, $name) "
        ),
        {"id": person_id, "name": name},
    )


def create_person_relationship(
    subject_id: str,
    related_id: str,
    relation: str,
    *,
    subject_name: Optional[str] = None,
    related_name: Optional[str] = None,
) -> Dict:
    """
    Create an interpersonal relationship between two persons.

    Contract:
    - relation supports: father/mother/parent -> PARENT_OF (related -> subject),
                        child -> CHILD_OF (subject -> related via PARENT_OF inverse),
                        spouse -> SPOUSE_OF (subject -> related),
                        friend -> FRIEND_OF (subject -> related),
                        classmate -> CLASSMATE_OF (subject -> related).
    - Ensures both nodes exist and have :Person label.
    - Returns { from, to, type }
    """
    rel = (relation or "").strip().upper()
    # Map aliases to canonical types and direction
    if rel in {"FATHER", "MOTHER", "PARENT"}:
        rel_type = "PARENT_OF"
        from_id, to_id = related_id, subject_id
    elif rel in {"CHILD", "CHILD_OF"}:
        rel_type = "PARENT_OF"  # stored as parent_of subject->child
        from_id, to_id = subject_id, related_id
    elif rel in {"SPOUSE", "SPOUSE_OF"}:
        rel_type = "SPOUSE_OF"
        from_id, to_id = subject_id, related_id
    elif rel in {"FRIEND", "FRIEND_OF"}:
        rel_type = "FRIEND_OF"
        from_id, to_id = subject_id, related_id
    elif rel in {"CLASSMATE", "CLASSMATE_OF"}:
        rel_type = "CLASSMATE_OF"
        from_id, to_id = subject_id, related_id
    else:
        raise ValueError(f"Unsupported relation type: {relation}")

    # Validate allowed set (Cypher safety)
    if rel_type not in ALLOWED_REL_TYPES:
        raise ValueError("Invalid relation label")

    # Ensure nodes exist
    _ensure_person(subject_id, subject_name)
    _ensure_person(related_id, related_name)

    # Create relationship. Relationship type must be inlined (not parameterized).
    query = (
        f"MATCH (a:Entity {{id: $from}}), (b:Entity {{id: $to}}) "
        f"MERGE (a)-[r:{rel_type}]->(b) "
        f"RETURN type(r) AS type, a.id AS a, b.id AS b"
    )
    res = run_cypher(query, {"from": from_id, "to": to_id})
    if not res:
        return {}
    row = res[0]
    return {"from": row.get("a"), "to": row.get("b"), "type": row.get("type")}
