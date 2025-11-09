from typing import Dict, Any, Optional, List
from app.db.neo4j_connector import run_cypher


def create_legal_rep(company_id: str, person_id: str, role: Optional[str] = None) -> Dict[str, Any]:
    """Create or update a LEGAL_REP relationship from a Person to a Company."""
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


def create_person(
    person_id: str,
    name: Optional[str] = None,
    type_: Optional[str] = None,
    basic_info: Optional[Dict[str, Any]] = None,
    id_info: Optional[Dict[str, Any]] = None,
    job_info: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create or update a Person entity."""
    query = (
        "MERGE (e:Entity {id: $id}) "
        "SET e:Person, "
        "    e.name = coalesce($name, e.name), "
        "    e.type = coalesce($type, e.type), "
        "    e.basic_info = coalesce($basic_info, e.basic_info), "
        "    e.id_info = coalesce($id_info, e.id_info), "
        "    e.job_info = coalesce($job_info, e.job_info) "
        "RETURN e.id AS id, e.name AS name, e.type AS type"
    )
    res = run_cypher(
        query,
        {
            "id": person_id,
            "name": name,
            "type": type_,
            "basic_info": basic_info,
            "id_info": id_info,
            "job_info": job_info,
        },
    )
    return res[0] if res else {}


def create_company(
    company_id: str,
    name: Optional[str] = None,
    type_: Optional[str] = None,
    business_info: Optional[Dict[str, Any]] = None,
    status: Optional[str] = None,
    industry: Optional[str] = None,
) -> Dict[str, Any]:
    """Create or update a Company entity with extra attributes."""
    query = (
        "MERGE (e:Entity {id: $id}) "
        "SET e:Company, "
        "    e.name = coalesce($name, e.name), "
        "    e.type = coalesce($type, e.type), "
        "    e.business_info = coalesce($business_info, e.business_info), "
        "    e.status = coalesce($status, e.status), "
        "    e.industry = coalesce($industry, e.industry) "
        "RETURN e.id AS id, e.name AS name, e.type AS type"
    )
    res = run_cypher(
        query,
        {
            "id": company_id,
            "name": name,
            "type": type_,
            "business_info": business_info,
            "status": status,
            "industry": industry,
        },
    )
    return res[0] if res else {}
