from typing import Dict, Any, List
from app.db.neo4j_connector import run_cypher


def create_employment(company_id: str, person_id: str, role: str | None = None) -> Dict[str, Any]:
    """Create or update a general SERVES_AS employment relation (person -> company)."""
    query = (
        "MERGE (c:Entity {id: $company}) "
        "MERGE (p:Entity {id: $person}) "
        "MERGE (p)-[r:SERVES_AS]->(c) "
        "SET r.role = $role "
        "RETURN p.id AS person_id, c.id AS company_id, r.role AS role"
    )
    res = run_cypher(query, {"company": company_id, "person": person_id, "role": role})
    return res[0] if res else {}


def get_employment(entity_id: str, role: str = "both") -> List[Dict[str, Any]]:
    """Return employment relationships (SERVES_AS) related to an entity."""
    role = (role or "both").lower()
    if role in ("company", "as_company"):
        query = (
            "MATCH (p:Entity)-[r:SERVES_AS]->(c:Entity {id: $id}) "
            "RETURN p.id AS person_id, c.id AS company_id, r.role AS role "
            "ORDER BY coalesce(r.role, '')"
        )
    elif role in ("person", "as_person"):
        query = (
            "MATCH (p:Entity {id: $id})-[r:SERVES_AS]->(c:Entity) "
            "RETURN p.id AS person_id, c.id AS company_id, r.role AS role "
            "ORDER BY coalesce(r.role, '')"
        )
    else:
        query = (
            "MATCH (p:Entity)-[r:SERVES_AS]->(c:Entity) "
            "WHERE p.id = $id OR c.id = $id "
            "RETURN p.id AS person_id, c.id AS company_id, r.role AS role "
            "ORDER BY coalesce(r.role, '')"
        )
    rows = run_cypher(query, {"id": entity_id})
    return rows or []
