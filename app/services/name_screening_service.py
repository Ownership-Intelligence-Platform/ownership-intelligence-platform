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


def screen_name_against_watchlist(name: str) -> List[Dict[str, Any]]:
    """Screen a name against a local watchlist.

    Returns a list of hits with a simple score field (3=exact, 2=contains/contained).
    """
    q = (name or "").strip()
    if not q:
        return []
    norm_q = _normalize_name(q)

    results: List[Dict[str, Any]] = []
    for item in _load_watchlist():
        wl_name = item.get("name") or ""
        norm_wl = _normalize_name(wl_name)
        if not norm_wl:
            continue

        score = 0
        if norm_q == norm_wl:
            score = 3
        elif norm_q in norm_wl or norm_wl in norm_q:
            score = 2

        if score > 0:
            results.append(
                {
                    "name": wl_name,
                    "type": item.get("type"),
                    "list": item.get("list"),
                    "risk_level": item.get("risk_level"),
                    "notes": item.get("notes"),
                    "score": score,
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
    watchlist_hits = screen_name_against_watchlist(q)
    return {
        "input": q,
        "entity_fuzzy_matches": entity_fuzzy_matches,
        "watchlist_hits": watchlist_hits,
    }
