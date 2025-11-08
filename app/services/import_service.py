import csv
import os
from typing import Callable, Dict, Tuple, Set, Optional

from app.services.graph_service import create_entity, create_ownership


RequiredEntityHeaders = {"id", "name", "type"}
RequiredOwnershipHeaders = {"owner_id", "owned_id", "stake"}
RequiredNewsHeaders = {"entity_id", "title", "url", "source", "published_at", "summary"}


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
    create_entity_fn: Callable[[str, str, str], Dict] = create_entity,
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
            if not eid:
                # Skip empty id lines
                continue
            if eid in entity_ids:
                continue
            entity_ids.add(eid)
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

            # Ensure nodes exist
            create_entity_fn(company_id, None, None)
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
