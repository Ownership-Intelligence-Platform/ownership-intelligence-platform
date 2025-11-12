from __future__ import annotations

import json
from typing import Dict, Iterable, List

from app.services.graph_service import create_entity, create_ownership
from app.services.graph.news import create_news_item


def import_news_jsonl(jsonl_path: str) -> Dict[str, int]:
    """Read normalized news records from a JSONL and import into Neo4j.

    Expects fields: entity_id, title, url, source, published_at, summary.
    Ensures entity exists. Returns summary counts.
    """
    processed = 0
    created = 0
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            processed += 1
            try:
                rec = json.loads(line)
            except Exception:
                continue
            entity_id = (rec.get("entity_id") or "").strip()
            if not entity_id:
                continue
            # Ensure entity exists
            create_entity(entity_id, None, None)
            create_news_item(
                entity_id,
                title=rec.get("title"),
                url=rec.get("url"),
                source=rec.get("source"),
                published_at=rec.get("published_at"),
                summary=rec.get("summary"),
            )
            created += 1
    return {"processed": processed, "created": created}


def import_companies_jsonl(jsonl_path: str) -> Dict[str, int]:
    """Create/merge companies from JSONL with fields: id, name, type, description."""
    processed = 0
    created = 0
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s:
                continue
            processed += 1
            try:
                rec = json.loads(s)
            except Exception:
                continue
            eid = (rec.get("id") or "").strip()
            if not eid:
                continue
            name = rec.get("name")
            type_ = rec.get("type")
            desc = rec.get("description")
            create_entity(eid, name, type_, desc)
            created += 1
    return {"processed": processed, "created": created}


def import_ownerships_jsonl(jsonl_path: str) -> Dict[str, int]:
    """Create ownership edges from JSONL with fields: owner_id, owned_id, stake."""
    processed = 0
    created = 0
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s:
                continue
            processed += 1
            try:
                rec = json.loads(s)
            except Exception:
                continue
            owner = (rec.get("owner_id") or "").strip()
            owned = (rec.get("owned_id") or "").strip()
            stake = rec.get("stake")
            if not owner or not owned:
                continue
            # Ensure nodes exist if absent
            create_entity(owner, None, None)
            create_entity(owned, None, None)
            try:
                stake_val = float(stake) if stake is not None else None
            except Exception:
                stake_val = None
            create_ownership(owner, owned, stake_val)
            created += 1
    return {"processed": processed, "created": created}
