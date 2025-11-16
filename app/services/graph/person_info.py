from typing import Any, Dict, Optional
import json
from app.db.neo4j_connector import run_cypher


def _mask_number(value: Optional[str], keep_tail: int = 4, mask_char: str = "•") -> Optional[str]:
    if not value:
        return value
    v = value.strip()
    if len(v) <= keep_tail:
        return mask_char * len(v)
    head = len(v) - keep_tail
    return mask_char * head + v[-keep_tail:]


def set_person_account_opening(person_id: str, info: Dict[str, Any]) -> Dict[str, Any]:
    """Set masked account opening info onto a Person (Entity) node.

    Neo4j node properties cannot store maps; only primitives or arrays. To persist
    a flexible set of fields, we serialize the masked payload as JSON into
    `p.account_opening_json`.

    Only masked versions of sensitive fields are persisted. Raw inputs are discarded.
    Stored keys: bank_name, account_type, currencies, account_number_masked,
                 name, id_no_masked, phone, email, address, employer
    """

    account_number = info.get("account_number")
    id_no = info.get("id_no")

    stored: Dict[str, Any] = {
        "bank_name": info.get("bank_name"),
        "account_type": info.get("account_type"),
        "currencies": info.get("currencies"),
        "account_number_masked": _mask_number(account_number),
        "name": info.get("name"),
        "id_no_masked": _mask_number(id_no),
        "phone": info.get("phone"),
        "email": info.get("email"),
        "address": info.get("address"),
        "employer": info.get("employer"),
    }

    json_payload = json.dumps(stored, ensure_ascii=False)
    query = (
        "MERGE (p:Entity {id: $id}) "
        "SET p:Person, p.account_opening_json = $ao_json "
        "RETURN p.account_opening_json AS account_opening_json"
    )
    run_cypher(query, {"id": person_id, "ao_json": json_payload})
    # Return the masked dict we just stored for convenience
    return stored


def get_person_account_opening(person_id: str) -> Dict[str, Any]:
    """Get account opening info for a Person (if any), else {}."""
    query = (
        "MATCH (p:Entity {id: $id}) "
        "RETURN p.account_opening_json AS account_opening_json"
    )
    res = run_cypher(query, {"id": person_id})
    if not res:
        return {}
    raw = res[0].get("account_opening_json")
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except Exception:
        return {}
    # Ensure only masked fields for sensitive data are exposed (defense-in-depth)
    data.pop("account_number", None)
    data.pop("id_no", None)
    return data
