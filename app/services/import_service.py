import csv
import os
from typing import Callable, Dict, Tuple, Set

from app.services.graph_service import create_entity, create_ownership


RequiredEntityHeaders = {"id", "name", "type"}
RequiredOwnershipHeaders = {"owner_id", "owned_id", "stake"}


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
