from typing import Dict, Any, Optional, List
from app.db.neo4j_connector import run_cypher
import json


def _json_or_none(val: Optional[Dict[str, Any]]) -> Optional[str]:
    """Serialize dict-like extended blocks to JSON strings for Neo4j storage.

    Neo4j property values must be primitives or arrays; nested maps are not valid
    as direct property values. We therefore store JSON strings (UTF-8, non-escaped
    Chinese) and parse them on read. None is preserved to avoid overwriting existing
    properties with blank strings.
    """
    if not val:
        return None
    try:
        return json.dumps(val, ensure_ascii=False)
    except Exception:
        # Fallback: return None so we don't set a broken serialization
        return None


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
    """Create or update a Person entity (basic version) using JSON string storage for maps."""
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
    params = {
        "id": person_id,
        "name": name,
        "type": type_,
        "basic_info": _json_or_none(basic_info),
        "id_info": _json_or_none(id_info),
        "job_info": _json_or_none(job_info),
    }
    res = run_cypher(query, params)
    return res[0] if res else {}


def create_or_update_person_extended(
    person_id: str,
    name: Optional[str] = None,
    type_: Optional[str] = None,
    basic_info: Optional[Dict[str, Any]] = None,
    id_info: Optional[Dict[str, Any]] = None,
    job_info: Optional[Dict[str, Any]] = None,
    kyc_info: Optional[Dict[str, Any]] = None,
    risk_profile: Optional[Dict[str, Any]] = None,
    network_info: Optional[Dict[str, Any]] = None,
    geo_profile: Optional[Dict[str, Any]] = None,
    compliance_info: Optional[Dict[str, Any]] = None,
    provenance: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Upsert a Person node with extended attributes using JSON serialization for nested dicts."""
    query = (
        "MERGE (e:Entity {id: $id}) "
        "SET e:Person, "
        "    e.name = coalesce($name, e.name), "
        "    e.type = coalesce($type, e.type), "
        "    e.basic_info = coalesce($basic_info, e.basic_info), "
        "    e.id_info = coalesce($id_info, e.id_info), "
        "    e.job_info = coalesce($job_info, e.job_info), "
        "    e.kyc_info = coalesce($kyc_info, e.kyc_info), "
        "    e.risk_profile = coalesce($risk_profile, e.risk_profile), "
        "    e.network_info = coalesce($network_info, e.network_info), "
        "    e.geo_profile = coalesce($geo_profile, e.geo_profile), "
        "    e.compliance_info = coalesce($compliance_info, e.compliance_info), "
        "    e.provenance = coalesce($provenance, e.provenance) "
        "RETURN e.id AS id, e.name AS name, e.type AS type"
    )
    params = {
        "id": person_id,
        "name": name,
        "type": type_,
        "basic_info": _json_or_none(basic_info),
        "id_info": _json_or_none(id_info),
        "job_info": _json_or_none(job_info),
        "kyc_info": _json_or_none(kyc_info),
        "risk_profile": _json_or_none(risk_profile),
        "network_info": _json_or_none(network_info),
        "geo_profile": _json_or_none(geo_profile),
        "compliance_info": _json_or_none(compliance_info),
        "provenance": _json_or_none(provenance),
    }
    res = run_cypher(query, params)
    return res[0] if res else {}


def get_person_extended(person_id: str) -> Dict[str, Any]:
    """Return all extended person properties, parsing JSON strings back into dicts."""
    q = (
        "MATCH (e:Person {id: $id}) "
        "RETURN e.id AS id, e.name AS name, e.type AS type, "
        "e.basic_info AS basic_info, e.id_info AS id_info, e.job_info AS job_info, "
        "e.kyc_info AS kyc_info, e.risk_profile AS risk_profile, e.network_info AS network_info, "
        "e.geo_profile AS geo_profile, e.compliance_info AS compliance_info, e.provenance AS provenance"
    )
    res = run_cypher(q, {"id": person_id})
    if not res:
        return {}
    row = res[0]
    def parse(v):
        if isinstance(v, str):
            v_strip = v.strip()
            if v_strip.startswith("{") or v_strip.startswith("["):
                try:
                    return json.loads(v_strip)
                except Exception:
                    return None
        return v
    for k in [
        "basic_info",
        "id_info",
        "job_info",
        "kyc_info",
        "risk_profile",
        "network_info",
        "geo_profile",
        "compliance_info",
        "provenance",
    ]:
        if k in row:
            row[k] = parse(row.get(k))
    return row


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
