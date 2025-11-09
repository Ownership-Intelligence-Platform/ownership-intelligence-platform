from typing import Dict, Any, List
from app.db.neo4j_connector import run_cypher


def create_account(
    owner_id: str,
    account_number: str,
    bank_name: str | None = None,
    balance: float | None = None,
) -> Dict[str, Any]:
    """Create or update an Account node and link it to an owner via HAS_ACCOUNT."""
    query = (
        "MERGE (o:Entity {id: $owner}) "
        "MERGE (a:Account {account_number: $acc}) "
        "SET a.bank_name = coalesce($bank, a.bank_name), "
        "    a.balance = coalesce($bal, a.balance) "
        "MERGE (o)-[:HAS_ACCOUNT]->(a) "
        "RETURN a.account_number AS account_number, a.bank_name AS bank_name, a.balance AS balance"
    )
    res = run_cypher(
        query, {"owner": owner_id, "acc": account_number, "bank": bank_name, "bal": balance}
    )
    return res[0] if res else {}


def get_accounts(owner_id: str) -> List[Dict[str, Any]]:
    """Return all Account nodes linked from an owner via HAS_ACCOUNT."""
    query = (
        "MATCH (o:Entity {id: $id})-[:HAS_ACCOUNT]->(a:Account) "
        "RETURN a.account_number AS account_number, a.bank_name AS bank_name, a.balance AS balance "
        "ORDER BY a.account_number"
    )
    rows = run_cypher(query, {"id": owner_id})
    return rows or []
