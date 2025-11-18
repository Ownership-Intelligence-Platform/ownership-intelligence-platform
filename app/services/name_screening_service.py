from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from app.services.graph_service import search_entities_fuzzy


_WATCHLIST_CACHE: List[Dict[str, Any]] | None = None


def _get_root_dir() -> str:
    """Return absolute project root (two levels up from this file)."""
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _load_watchlist() -> List[Dict[str, Any]]:
    """Load local name watchlist from app/kb/name_watchlist.json if present.

    The file is optional; if missing or invalid, an empty list is returned.
    """
    global _WATCHLIST_CACHE
    if _WATCHLIST_CACHE is not None:
        return _WATCHLIST_CACHE

    root = _get_root_dir()
    path = os.path.join(root, "kb", "name_watchlist.json")
    if not os.path.exists(path):
        _WATCHLIST_CACHE = []
        return _WATCHLIST_CACHE

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        _WATCHLIST_CACHE = []
        return _WATCHLIST_CACHE

    if not isinstance(data, list):
        data = []
    _WATCHLIST_CACHE = data
    return _WATCHLIST_CACHE


def _normalize_name(name: str) -> str:
    """Normalize names by removing whitespace and lowercasing for loose matching."""
    return "".join(str(name or "").split()).lower()


def _iter_watchlist_variants(item: Dict[str, Any]) -> List[Dict[str, str]]:
    """Yield (value, kind) pairs for name/alias variants in a watchlist item.

    kind is one of: "name", "alias". This allows downstream to tag match_by.
    """
    variants: List[Dict[str, str]] = []
    main = (item.get("name") or "").strip()
    if main:
        variants.append({"value": main, "kind": "name"})
    aliases = item.get("aliases") or []
    if isinstance(aliases, list):
        for a in aliases:
            v = (a or "").strip()
            if v and v != main:
                variants.append({"value": v, "kind": "alias"})
    return variants


def screen_name_against_watchlist(name: str) -> List[Dict[str, Any]]:
    """Screen a name against a local watchlist.

    Returns a list of hits with score and match_by metadata, where match_by
    indicates whether the hit came from the primary name or an alias.
    """
    q = (name or "").strip()
    if not q:
        return []
    norm_q = _normalize_name(q)

    results: List[Dict[str, Any]] = []
    for item in _load_watchlist():
        for variant in _iter_watchlist_variants(item):
            wl_name = variant["value"]
            norm_wl = _normalize_name(wl_name)
            if not norm_wl:
                continue

            score = 0
            match_by = "alias" if variant["kind"] == "alias" else "exact"
            if norm_q == norm_wl:
                score = 3
            elif norm_q in norm_wl or norm_wl in norm_q:
                score = 2
                if match_by == "exact":
                    match_by = "fuzzy"

            if score > 0:
                results.append(
                    {
                        "name": wl_name,
                        "type": item.get("type"),
                        "list": item.get("list"),
                        "risk_level": item.get("risk_level"),
                        "notes": item.get("notes"),
                        "score": score,
                        "match_by": match_by,
                    }
                )

    results.sort(key=lambda r: (-r["score"], r["name"]))
    return results


def basic_name_scan(name: str, *, fuzzy_limit: int = 5) -> Dict[str, Any]:
    """Run a basic name scan for a customer/entity name.

    Combines:
    - Fuzzy search over existing entities (internal duplicates / similar clients).
    - Local watchlist screening (simulated sanctions/PEP list).
    """
    q = (name or "").strip()
    if not q:
        return {"input": name, "entity_fuzzy_matches": [], "watchlist_hits": []}

    entity_fuzzy_matches = search_entities_fuzzy(q, limit=fuzzy_limit)
    # Annotate entity matches with basic match_by metadata. The underlying
    # search_entities_fuzzy already uses startswith/contains semantics, so we
    # can map score to a simple label.
    for m in entity_fuzzy_matches:
        score = int(m.get("score") or 0)
        if score >= 2:
            m["match_by"] = "startswith"
        elif score == 1:
            m["match_by"] = "contains"
        else:
            m["match_by"] = "fuzzy"
    watchlist_hits = screen_name_against_watchlist(q)
    return {
        "input": q,
        "entity_fuzzy_matches": entity_fuzzy_matches,
        "watchlist_hits": watchlist_hits,
    }
