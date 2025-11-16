import csv
import os
from typing import Callable, Dict, Tuple, Set, Optional

from app.services.graph_service import create_entity, create_ownership


RequiredEntityHeaders = {"id", "name", "type"}
RequiredOwnershipHeaders = {"owner_id", "owned_id", "stake"}
RequiredNewsHeaders = {"entity_id", "title", "url", "source", "published_at", "summary"}

# Phase 2: new required headers for extended imports
RequiredAccountsHeaders = {"owner_id", "account_number", "bank_name", "balance"}
RequiredLocationsHeaders = {"entity_id", "registered", "operating", "offshore"}
RequiredTransactionsHeaders = {"from_id", "to_id", "amount", "time", "tx_type", "channel"}
RequiredGuaranteesHeaders = {"guarantor_id", "guaranteed_id", "amount"}
RequiredSupplyChainHeaders = {"supplier_id", "customer_id", "frequency"}
RequiredEmploymentHeaders = {"company_id", "person_id", "role"}
RequiredPersonOpeningHeaders = {
    "person_id",
    # optional: but we include in required set only person_id; others validated at use time
}

# Relationships (person-to-person)
RequiredRelationshipsHeaders = {"subject_id", "related_id", "relation"}


def _resolve_path(path: str, project_root: str) -> str:
    """Resolve a possibly relative path against the project root.

    If path is absolute, return it unchanged. Otherwise, join to project_root.
    """
    if os.path.isabs(path):
        return path
    return os.path.join(project_root, path)


def import_graph_from_csv(
    entities_csv: str,
    ownerships_csv: str,
    *,
    project_root: str,
    create_entity_fn: Callable[[str, Optional[str], Optional[str], Optional[str]], Dict] = create_entity,
    create_ownership_fn: Callable[[str, str, float], Dict] = create_ownership,
) -> Dict:
    """Import entities and ownerships from CSV files.

    Contract:
    - Inputs: paths to CSV files (may be relative to project_root), functions to create nodes/edges
    - Outputs: summary dict with counts and basic diagnostics
    - Errors: raises FileNotFoundError for missing files; ValueError for malformed headers/rows
    """

    pr = os.path.abspath(project_root)
    e_path = _resolve_path(entities_csv, pr)
    o_path = _resolve_path(ownerships_csv, pr)

    if not os.path.isfile(e_path):
        raise FileNotFoundError(f"Entities CSV not found: {e_path}")
    if not os.path.isfile(o_path):
        raise FileNotFoundError(f"Ownerships CSV not found: {o_path}")

    # Import entities (dedupe by id to avoid redundant MERGEs)
    entities_processed = 0
    entity_ids: Set[str] = set()
    with open(e_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = {h.strip() for h in (reader.fieldnames or [])}
        if not RequiredEntityHeaders.issubset(headers):
            missing = RequiredEntityHeaders - headers
            raise ValueError(f"Entities CSV missing required columns: {', '.join(sorted(missing))}")
        for row in reader:
            entities_processed += 1
            eid = (row.get("id") or "").strip()
            name = (row.get("name") or None)
            type_ = (row.get("type") or None)
            description = (row.get("description") or None)
            if not eid:
                # Skip empty id lines
                continue
            if eid in entity_ids:
                continue
            entity_ids.add(eid)
            # Backward-compatible call: some injected fakes/tests may accept only 3 args
            try:
                create_entity_fn(eid, name, type_, description)
            except TypeError:
                create_entity_fn(eid, name, type_)

    # Import ownerships (optional dedupe by (owner, owned, stake))
    ownerships_processed = 0
    ownership_pairs: Set[Tuple[str, str, float]] = set()
    with open(o_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = {h.strip() for h in (reader.fieldnames or [])}
        if not RequiredOwnershipHeaders.issubset(headers):
            missing = RequiredOwnershipHeaders - headers
            raise ValueError(f"Ownerships CSV missing required columns: {', '.join(sorted(missing))}")
        for row in reader:
            ownerships_processed += 1
            owner = (row.get("owner_id") or "").strip()
            owned = (row.get("owned_id") or "").strip()
            stake_str = (row.get("stake") or "").strip()
            if not owner or not owned:
                # Skip incomplete lines
                continue
            try:
                stake = float(stake_str) if stake_str != "" else None
            except ValueError as exc:
                raise ValueError(f"Invalid stake value for {owner}->{owned}: {stake_str}") from exc

            key = (owner, owned, float(stake) if stake is not None else float("nan"))
            # We only dedupe exact duplicates; allow multiple edges with different stakes if present
            if key in ownership_pairs:
                continue
            ownership_pairs.add(key)

            # Ensure nodes exist in case entities.csv omitted some referenced ids
            if owner not in entity_ids:
                create_entity_fn(owner, None, None)
                entity_ids.add(owner)
            if owned not in entity_ids:
                create_entity_fn(owned, None, None)
                entity_ids.add(owned)

            create_ownership_fn(owner, owned, stake)

    return {
        "entities": {
            "processed_rows": entities_processed,
            "unique_imported": len(entity_ids),
        },
        "ownerships": {
            "processed_rows": ownerships_processed,
            "unique_imported": len(ownership_pairs),
        },
    }


def import_legal_reps_from_csv(
    legal_reps_csv: str,
    *,
    project_root: str,
    create_entity_fn: Callable[[str, Optional[str], Optional[str]], Dict] = create_entity,
    create_legal_rep_fn: Callable[[str, str, Optional[str]], Dict] = None,
) -> Dict:
    """Import legal representatives from a CSV (columns: company_id, person_id, role).

    Returns a summary dict with processed and unique counts. Ensures nodes exist.
    """
    if create_legal_rep_fn is None:
        # late import to avoid circulars if used externally
        from app.services.graph_service import create_legal_rep as _clr

        create_legal_rep_fn = _clr

    pr = os.path.abspath(project_root)
    path = _resolve_path(legal_reps_csv, pr)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Legal reps CSV not found: {path}")

    required = {"company_id", "person_id", "role"}
    processed = 0
    unique = 0
    seen: Set[Tuple[str, str, Optional[str]]] = set()

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = {h.strip() for h in (reader.fieldnames or [])}
        if not required.issubset(headers):
            missing = required - headers
            raise ValueError(f"Legal reps CSV missing required columns: {', '.join(sorted(missing))}")
        for row in reader:
            processed += 1
            company_id = (row.get("company_id") or "").strip()
            person_id = (row.get("person_id") or "").strip()
            role = (row.get("role") or "").strip() or None
            if not company_id or not person_id:
                continue
            key = (company_id, person_id, role)
            if key in seen:
                continue
            seen.add(key)

            # Ensure nodes exist:
            # Business rule: companies are expected to have been imported already via the main
            # entities dataset; we only auto-create the person placeholder if needed to avoid
            # polluting the graph with partially specified companies (test expectation).
            # (We still create the person because people often appear first here.)
            create_entity_fn(person_id, None, None)
            create_legal_rep_fn(company_id, person_id, role)
            unique += 1

    return {
        "legal_representatives": {
            "processed_rows": processed,
            "unique_imported": unique,
        }
    }


def import_news_from_csv(
    news_csv: str,
    *,
    project_root: str,
    create_news_fn: Callable[[str, Optional[str], Optional[str], Optional[str], Optional[str], Optional[str]], Dict] = None,
    ensure_entity_fn: Callable[[str, Optional[str], Optional[str]], Dict] = create_entity,
) -> Dict:
    """Import news items from a CSV file.

    Expected headers: entity_id,title,url,source,published_at,summary
    Each row creates/merges a News node and links (Entity)-[:HAS_NEWS]->(News).
    """
    if create_news_fn is None:
        from app.services.graph_service import create_news_item as _cni
        create_news_fn = _cni

    pr = os.path.abspath(project_root)
    path = _resolve_path(news_csv, pr)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"News CSV not found: {path}")

    processed = 0
    unique = 0
    seen: Set[Tuple[str, Optional[str]]] = set()  # (entity_id, url) dedupe
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = {h.strip() for h in (reader.fieldnames or [])}
        if not RequiredNewsHeaders.issubset(headers):
            missing = RequiredNewsHeaders - headers
            raise ValueError(f"News CSV missing required columns: {', '.join(sorted(missing))}")
        for row in reader:
            processed += 1
            entity_id = (row.get("entity_id") or "").strip()
            if not entity_id:
                continue
            title = (row.get("title") or "").strip() or None
            url = (row.get("url") or "").strip() or None
            source = (row.get("source") or "").strip() or None
            published_at = (row.get("published_at") or "").strip() or None
            summary = (row.get("summary") or "").strip() or None
            key = (entity_id, url or title)
            if key in seen:
                continue
            seen.add(key)
            # Ensure entity exists
            ensure_entity_fn(entity_id, None, None)
            create_news_fn(entity_id, title, url, source, published_at, summary)
            unique += 1

    return {
        "news": {
            "processed_rows": processed,
            "unique_imported": unique,
        }
    }


# --- Extended imports (Phase 2) ---

def import_accounts_from_csv(
    accounts_csv: str,
    *,
    project_root: str,
    create_account_fn: Callable[[str, str, str, float], Dict],
    ensure_entity_fn: Callable[[str, Optional[str], Optional[str]], Dict] = create_entity,
) -> Dict:
    """Import accounts and link to owners via HAS_ACCOUNT.

    Expected headers: owner_id,account_number,bank_name,balance
    """
    pr = os.path.abspath(project_root)
    path = _resolve_path(accounts_csv, pr)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Accounts CSV not found: {path}")

    processed = 0
    unique = 0
    seen: Set[Tuple[str, str]] = set()  # (owner_id, account_number)
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = {h.strip() for h in (reader.fieldnames or [])}
        if not RequiredAccountsHeaders.issubset(headers):
            missing = RequiredAccountsHeaders - headers
            raise ValueError(f"Accounts CSV missing required columns: {', '.join(sorted(missing))}")
        for row in reader:
            processed += 1
            owner_id = (row.get("owner_id") or "").strip()
            acc_no = (row.get("account_number") or "").strip()
            bank = (row.get("bank_name") or "").strip() or None
            bal_str = (row.get("balance") or "").strip()
            if not owner_id or not acc_no:
                continue
            try:
                bal = float(bal_str) if bal_str != "" else None
            except ValueError as exc:
                raise ValueError(f"Invalid balance for account {acc_no}: {bal_str}") from exc

            key = (owner_id, acc_no)
            if key in seen:
                continue
            seen.add(key)
            ensure_entity_fn(owner_id, None, None)
            create_account_fn(owner_id, acc_no, bank, bal)
            unique += 1

    return {"accounts": {"processed_rows": processed, "unique_imported": unique}}


def import_person_account_opening_from_csv(
    opening_csv: str,
    *,
    project_root: str,
    set_opening_fn: Callable[[str, Dict], Dict],
    ensure_person_fn: Callable[[str, Optional[str], Optional[str]], Dict] = create_entity,
) -> Dict:
    """
    Import person account opening metadata.

    CSV requirements:
      - Header must contain 'person_id'
      - Additional columns are treated as opening attributes (flexible schema)
    For each row:
      - Ensure person node exists (id=person_id, type='Person')
      - Call set_opening_fn(person_id, payload_dict)
    Returns:
      {
        "person_account_opening": {
            "processed_rows": <int>,
            "updated": <int>
        }
      }
    """
    pr = os.path.abspath(project_root)
    path = _resolve_path(opening_csv, pr)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Person account-opening CSV not found: {path}")

    processed = 0
    updated = 0
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if "person_id" not in reader.fieldnames:
            raise ValueError("Person account-opening CSV missing required column: person_id")
        for row in reader:
            processed += 1
            person_id = (row.get("person_id") or "").strip()
            if not person_id:
                continue  # skip empty id
            # Ensure person node exists (minimal attributes; extend if columns present)
            ensure_person_fn(person_id, row.get("name"), "Person")
            # Build payload excluding person_id
            payload = {k: v for k, v in row.items() if k != "person_id" and v not in (None, "")}
            try:
                set_opening_fn(person_id, payload)
                updated += 1
            except Exception:
                # Swallow individual row errors; could add logging
                continue

    return {
        "person_account_opening": {
            "processed_rows": processed,
            "updated": updated,
        }
    }


def import_locations_from_csv(
    locations_csv: str,
    *,
    project_root: str,
    create_location_links_fn: Callable[[str, Optional[str], Optional[str], Optional[str]], Dict],
    ensure_entity_fn: Callable[[str, Optional[str], Optional[str]], Dict] = create_entity,
) -> Dict:
    """Import location links for entities.

    Expected headers: entity_id,registered,operating,offshore
    """
    pr = os.path.abspath(project_root)
    path = _resolve_path(locations_csv, pr)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Locations CSV not found: {path}")

    processed = 0
    updated = 0
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = {h.strip() for h in (reader.fieldnames or [])}
        if not RequiredLocationsHeaders.issubset(headers):
            missing = RequiredLocationsHeaders - headers
            raise ValueError(f"Locations CSV missing required columns: {', '.join(sorted(missing))}")
        for row in reader:
            processed += 1
            eid = (row.get("entity_id") or "").strip()
            if not eid:
                continue
            registered = (row.get("registered") or "").strip() or None
            operating = (row.get("operating") or "").strip() or None
            offshore = (row.get("offshore") or "").strip() or None
            ensure_entity_fn(eid, None, None)
            create_location_links_fn(eid, registered, operating, offshore)
            updated += 1

    return {"locations": {"processed_rows": processed, "updated": updated}}


def import_transactions_from_csv(
    transactions_csv: str,
    *,
    project_root: str,
    create_transaction_fn: Callable[[str, str, float, Optional[str], Optional[str], Optional[str]], Dict],
    ensure_entity_fn: Callable[[str, Optional[str], Optional[str]], Dict] = create_entity,
) -> Dict:
    """Import transactions as nodes between two entities.

    Expected headers: from_id,to_id,amount,time,tx_type,channel
    """
    pr = os.path.abspath(project_root)
    path = _resolve_path(transactions_csv, pr)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Transactions CSV not found: {path}")

    processed = 0
    created = 0
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = {h.strip() for h in (reader.fieldnames or [])}
        if not RequiredTransactionsHeaders.issubset(headers):
            missing = RequiredTransactionsHeaders - headers
            raise ValueError(f"Transactions CSV missing required columns: {', '.join(sorted(missing))}")
        for row in reader:
            processed += 1
            from_id = (row.get("from_id") or "").strip()
            to_id = (row.get("to_id") or "").strip()
            amt_str = (row.get("amount") or "").strip()
            time = (row.get("time") or "").strip() or None
            tx_type = (row.get("tx_type") or "").strip() or None
            channel = (row.get("channel") or "").strip() or None
            if not from_id or not to_id or amt_str == "":
                continue
            try:
                amount = float(amt_str)
            except ValueError as exc:
                raise ValueError(f"Invalid amount for {from_id}->{to_id}: {amt_str}") from exc
            ensure_entity_fn(from_id, None, None)
            ensure_entity_fn(to_id, None, None)
            create_transaction_fn(from_id, to_id, amount, time, tx_type, channel)
            created += 1

    return {"transactions": {"processed_rows": processed, "created": created}}


def import_guarantees_from_csv(
    guarantees_csv: str,
    *,
    project_root: str,
    create_guarantee_fn: Callable[[str, str, float], Dict],
    ensure_entity_fn: Callable[[str, Optional[str], Optional[str]], Dict] = create_entity,
) -> Dict:
    """Import guarantee relationships.

    Expected headers: guarantor_id,guaranteed_id,amount
    """
    pr = os.path.abspath(project_root)
    path = _resolve_path(guarantees_csv, pr)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Guarantees CSV not found: {path}")

    processed = 0
    unique = 0
    seen: Set[Tuple[str, str, float]] = set()
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = {h.strip() for h in (reader.fieldnames or [])}
        if not RequiredGuaranteesHeaders.issubset(headers):
            missing = RequiredGuaranteesHeaders - headers
            raise ValueError(f"Guarantees CSV missing required columns: {', '.join(sorted(missing))}")
        for row in reader:
            processed += 1
            guarantor = (row.get("guarantor_id") or "").strip()
            guaranteed = (row.get("guaranteed_id") or "").strip()
            amt_str = (row.get("amount") or "").strip()
            if not guarantor or not guaranteed or amt_str == "":
                continue
            try:
                amount = float(amt_str)
            except ValueError as exc:
                raise ValueError(f"Invalid guarantee amount {amt_str}") from exc
            key = (guarantor, guaranteed, amount)
            if key in seen:
                continue
            seen.add(key)
            ensure_entity_fn(guarantor, None, None)
            ensure_entity_fn(guaranteed, None, None)
            create_guarantee_fn(guarantor, guaranteed, amount)
            unique += 1

    return {"guarantees": {"processed_rows": processed, "unique_imported": unique}}


def import_supply_chain_from_csv(
    supply_csv: str,
    *,
    project_root: str,
    create_supply_link_fn: Callable[[str, str, Optional[int]], Dict],
    ensure_entity_fn: Callable[[str, Optional[str], Optional[str]], Dict] = create_entity,
) -> Dict:
    """Import supply chain relationships from supplier to customer.

    Expected headers: supplier_id,customer_id,frequency
    """
    pr = os.path.abspath(project_root)
    path = _resolve_path(supply_csv, pr)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Supply chain CSV not found: {path}")

    processed = 0
    unique = 0
    seen: Set[Tuple[str, str, Optional[int]]] = set()
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = {h.strip() for h in (reader.fieldnames or [])}
        if not RequiredSupplyChainHeaders.issubset(headers):
            missing = RequiredSupplyChainHeaders - headers
            raise ValueError(f"Supply chain CSV missing required columns: {', '.join(sorted(missing))}")
        for row in reader:
            processed += 1
            supplier = (row.get("supplier_id") or "").strip()
            customer = (row.get("customer_id") or "").strip()
            freq_str = (row.get("frequency") or "").strip()
            if not supplier or not customer:
                continue
            try:
                frequency = int(freq_str) if freq_str != "" else None
            except ValueError as exc:
                raise ValueError(f"Invalid frequency value: {freq_str}") from exc
            key = (supplier, customer, frequency)
            if key in seen:
                continue
            seen.add(key)
            ensure_entity_fn(supplier, None, None)
            ensure_entity_fn(customer, None, None)
            create_supply_link_fn(supplier, customer, frequency)
            unique += 1

    return {"supply_chain": {"processed_rows": processed, "unique_imported": unique}}


def import_employment_from_csv(
    employment_csv: str,
    *,
    project_root: str,
    create_employment_fn: Callable[[str, str, Optional[str]], Dict],
    ensure_entity_fn: Callable[[str, Optional[str], Optional[str]], Dict] = create_entity,
) -> Dict:
    """Import general employment/position relations (person -> company).

    Expected headers: company_id,person_id,role
    """
    pr = os.path.abspath(project_root)
    path = _resolve_path(employment_csv, pr)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Employment CSV not found: {path}")

    processed = 0
    unique = 0
    seen: Set[Tuple[str, str, Optional[str]]] = set()
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = {h.strip() for h in (reader.fieldnames or [])}
        if not RequiredEmploymentHeaders.issubset(headers):
            missing = RequiredEmploymentHeaders - headers
            raise ValueError(f"Employment CSV missing required columns: {', '.join(sorted(missing))}")
        for row in reader:
            processed += 1
            company_id = (row.get("company_id") or "").strip()
            person_id = (row.get("person_id") or "").strip()
            role = (row.get("role") or "").strip() or None
            if not company_id or not person_id:
                continue
            key = (company_id, person_id, role)
            if key in seen:
                continue
            seen.add(key)
            ensure_entity_fn(company_id, None, None)
            ensure_entity_fn(person_id, None, None)
            create_employment_fn(company_id, person_id, role)
            unique += 1

    return {"employment": {"processed_rows": processed, "unique_imported": unique}}


def import_relationships_from_csv(
    relationships_csv: str,
    *,
    project_root: str,
    create_relationship_fn: Callable[[str, str, str], Dict],
    ensure_person_fn: Callable[[str, Optional[str], Optional[str]], Dict] = create_entity,
) -> Dict:
    """Import interpersonal relationships between persons.

    Expected headers: subject_id,related_id,relation[,subject_name][,related_name]

    Behavior:
    - Ensures both persons exist (sets :Person label via ensure_person_fn)
    - Calls create_relationship_fn(subject_id, related_id, relation)
    - Dedupe by (subject_id, related_id, relation) triple
    """
    pr = os.path.abspath(project_root)
    path = _resolve_path(relationships_csv, pr)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Relationships CSV not found: {path}")

    processed = 0
    unique = 0
    seen: Set[Tuple[str, str, str]] = set()
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = {h.strip() for h in (reader.fieldnames or [])}
        if not RequiredRelationshipsHeaders.issubset(headers):
            missing = RequiredRelationshipsHeaders - headers
            raise ValueError(
                f"Relationships CSV missing required columns: {', '.join(sorted(missing))}"
            )
        for row in reader:
            processed += 1
            s = (row.get("subject_id") or "").strip()
            r = (row.get("related_id") or "").strip()
            rel = (row.get("relation") or "").strip()
            if not s or not r or not rel:
                continue
            key = (s, r, rel.upper())
            if key in seen:
                continue
            seen.add(key)
            # Ensure persons
            ensure_person_fn(s, row.get("subject_name"), "Person")
            ensure_person_fn(r, row.get("related_name"), "Person")
            # Create edge
            try:
                create_relationship_fn(s, r, rel)
                unique += 1
            except Exception:
                # skip invalid rows but continue import
                continue

    return {"relationships": {"processed_rows": processed, "unique_imported": unique}}
