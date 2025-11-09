"""Risk analysis service.

Provides heuristics to flag potentially risky items related to an Entity.

The goal is NOT to produce a perfect AML/KYC engine, but to surface obvious
signals that can be refined later. All logic is rule-based and deliberately
transparent. Each item returned includes the reasons (flags) and a simple
numeric score (sum of flag weights) to allow quick sorting.

Public entrypoint: analyze_entity_risks(entity_id: str) -> Dict.

Injection-friendly: All underlying data fetch functions can be overridden
for testing (to avoid needing a live Neo4j database).
"""

from __future__ import annotations

from typing import Callable, Dict, List, Any, Optional
import re

from app.services.graph_service import (
    get_entity,
    get_accounts,
    get_transactions,
    get_guarantees,
    get_supply_chain,
    get_stored_news,
)
from app.services.news_service import get_company_news

# --- Tunable thresholds (can be externalized later) ---
ACCOUNT_HIGH_BALANCE = 1_000_000.0  # High balance threshold
TRANSACTION_LARGE_AMOUNT = 500_000.0  # Large tx amount
GUARANTEE_LARGE_AMOUNT = 1_000_000.0  # Large guarantee
SUPPLY_HIGH_FREQUENCY = 50  # High supply frequency

NEGATIVE_NEWS_KEYWORDS = [
    "fraud",
    "scandal",
    "investigation",
    "lawsuit",
    "bankruptcy",
    "probe",
    "breach",
    "bribery",
]

KEYWORD_PATTERN = re.compile(r"|".join(re.escape(k) for k in NEGATIVE_NEWS_KEYWORDS), re.IGNORECASE)


def _flag(item: Dict[str, Any], reason: str, weight: float, flags_acc: List[str]):
    flags_acc.append(reason)
    item.setdefault("risk_flags", []).append(reason)
    item["risk_score"] = float(item.get("risk_score", 0.0) + weight)


def _assess_accounts(accounts: List[Dict[str, Any]]) -> Dict[str, Any]:
    risky: List[Dict[str, Any]] = []
    for acc in accounts:
        flags: List[str] = []
        bal = acc.get("balance")
        if bal is not None and bal >= ACCOUNT_HIGH_BALANCE:
            _flag(acc, f"High balance >= {ACCOUNT_HIGH_BALANCE}", 2.0, flags)
        # Example additional heuristic: missing bank name
        if not acc.get("bank_name"):
            _flag(acc, "Missing bank name", 0.5, flags)
        if flags:
            risky.append(acc)
    return {
        "items": accounts,
        "risky": risky,
        "count": len(accounts),
        "risky_count": len(risky),
    }


def _assess_transactions(txs: List[Dict[str, Any]], entity_id: str) -> Dict[str, Any]:
    risky: List[Dict[str, Any]] = []
    for tx in txs:
        flags: List[str] = []
        amt = tx.get("amount")
        channel = tx.get("channel") or ""
        if amt is not None and amt >= TRANSACTION_LARGE_AMOUNT:
            _flag(tx, f"Large amount >= {TRANSACTION_LARGE_AMOUNT}", 2.0, flags)
        if channel.lower() in {"cash", "crypto"}:
            _flag(tx, f"High-risk channel: {channel}", 1.5, flags)
        if not tx.get("time"):
            _flag(tx, "Missing timestamp", 0.5, flags)
        # Potential self-loop (entity transacts with itself)
        if tx.get("from_id") == tx.get("to_id"):
            _flag(tx, "Self-loop transaction", 2.0, flags)
        if flags:
            risky.append(tx)
    return {
        "items": txs,
        "risky": risky,
        "count": len(txs),
        "risky_count": len(risky),
    }


def _assess_guarantees(gs: List[Dict[str, Any]], entity_id: str) -> Dict[str, Any]:
    risky: List[Dict[str, Any]] = []
    for g in gs:
        flags: List[str] = []
        amt = g.get("amount")
        if amt is not None and amt >= GUARANTEE_LARGE_AMOUNT:
            _flag(g, f"Large guarantee >= {GUARANTEE_LARGE_AMOUNT}", 2.0, flags)
        if g.get("guarantor_id") == g.get("guaranteed_id"):
            _flag(g, "Self guarantee", 2.0, flags)
        if flags:
            risky.append(g)
    return {
        "items": gs,
        "risky": risky,
        "count": len(gs),
        "risky_count": len(risky),
    }


def _assess_supply_chain(sc: List[Dict[str, Any]], entity_id: str) -> Dict[str, Any]:
    risky: List[Dict[str, Any]] = []
    for rel in sc:
        flags: List[str] = []
        freq = rel.get("frequency")
        if freq is not None and freq >= SUPPLY_HIGH_FREQUENCY:
            _flag(rel, f"High supply frequency >= {SUPPLY_HIGH_FREQUENCY}", 1.5, flags)
        if rel.get("supplier_id") == rel.get("customer_id"):
            _flag(rel, "Self supplier/customer", 2.0, flags)
        if flags:
            risky.append(rel)
    return {
        "items": sc,
        "risky": risky,
        "count": len(sc),
        "risky_count": len(risky),
    }


def _assess_news(stored: List[Dict[str, Any]], external: List[Dict[str, Any]]) -> Dict[str, Any]:
    # Merge (stored prioritized) and flag by keyword match.
    combined: List[Dict[str, Any]] = []
    seen = set()
    for item in stored + external:
        key = item.get("url") or item.get("title")
        if not key or key in seen:
            continue
        seen.add(key)
        flags: List[str] = []
        text = " ".join(filter(None, [item.get("title"), item.get("summary")]))
        if KEYWORD_PATTERN.search(text):
            _flag(item, "Negative news keyword", 2.0, flags)
        if not item.get("summary"):
            _flag(item, "Missing summary", 0.3, flags)
        combined.append(item)
    risky = [i for i in combined if i.get("risk_flags")]
    return {
        "items": combined,
        "risky": risky,
        "count": len(combined),
        "risky_count": len(risky),
    }


def analyze_entity_risks(
    entity_id: str,
    *,
    get_entity_fn: Callable[[str], Dict[str, Any]] = get_entity,
    get_accounts_fn: Callable[[str], List[Dict[str, Any]]] = get_accounts,
    get_transactions_fn: Callable[[str, str], List[Dict[str, Any]]] = lambda eid, direction="both": get_transactions(eid, direction),
    get_guarantees_fn: Callable[[str, str], List[Dict[str, Any]]] = lambda eid, direction="both": get_guarantees(eid, direction),
    get_supply_chain_fn: Callable[[str, str], List[Dict[str, Any]]] = lambda eid, direction="both": get_supply_chain(eid, direction),
    get_stored_news_fn: Callable[[str], List[Dict[str, Any]]] = get_stored_news,
    get_external_news_fn: Callable[[str, int], List[Dict[str, Any]]] = lambda name, limit=10: get_company_news(name, limit=limit),
    news_limit: int = 10,
) -> Dict[str, Any]:
    """Compute risk summary for an entity.

    Returns a dict with sections: accounts, transactions, guarantees, supply_chain, news, summary.
    Each section has: items, risky, count, risky_count.
    summary aggregates total counts and a simple overall risk_score (sum of risky item scores).
    """
    entity = get_entity_fn(entity_id)
    if not entity:
        return {}

    # Fetch related data
    accounts = get_accounts_fn(entity_id)
    transactions = get_transactions_fn(entity_id, "both")
    guarantees = get_guarantees_fn(entity_id, "both")
    supply_chain = get_supply_chain_fn(entity_id, "both")
    stored_news = get_stored_news_fn(entity_id)
    external_news = get_external_news_fn(entity.get("name") or entity_id, news_limit)

    # Assess
    acc_section = _assess_accounts(accounts)
    tx_section = _assess_transactions(transactions, entity_id)
    g_section = _assess_guarantees(guarantees, entity_id)
    sc_section = _assess_supply_chain(supply_chain, entity_id)
    news_section = _assess_news(stored_news, external_news)

    # Aggregate overall score (sum of item scores in risky lists)
    overall_score = 0.0
    total_risky_items = 0
    total_items = 0
    for section in [acc_section, tx_section, g_section, sc_section, news_section]:
        total_items += section["count"]
        total_risky_items += section["risky_count"]
        for item in section["risky"]:
            overall_score += float(item.get("risk_score", 0.0))

    return {
        "entity": entity,
        "accounts": acc_section,
        "transactions": tx_section,
        "guarantees": g_section,
        "supply_chain": sc_section,
        "news": news_section,
        "summary": {
            "total_items": total_items,
            "total_risky_items": total_risky_items,
            "overall_risk_score": overall_score,
        },
        "thresholds": {
            "ACCOUNT_HIGH_BALANCE": ACCOUNT_HIGH_BALANCE,
            "TRANSACTION_LARGE_AMOUNT": TRANSACTION_LARGE_AMOUNT,
            "GUARANTEE_LARGE_AMOUNT": GUARANTEE_LARGE_AMOUNT,
            "SUPPLY_HIGH_FREQUENCY": SUPPLY_HIGH_FREQUENCY,
            "NEGATIVE_NEWS_KEYWORDS": NEGATIVE_NEWS_KEYWORDS,
        },
    }
