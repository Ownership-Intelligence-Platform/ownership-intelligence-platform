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
import json
import os
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
from app.services.llm_client import get_llm_client

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

# --- KB (Knowledge Base) loading (MVP) ---
_KB_CACHE: Dict[str, Any] = {}

def load_kb(force: bool = False) -> Dict[str, Any]:
    """Load KB JSON files (rules, lists, taxonomy) into a cache.

    Files reside in app/kb/. If a file is missing, returns partial data.
    This simple loader avoids adding new dependencies.
    """
    global _KB_CACHE
    if _KB_CACHE and not force:
        return _KB_CACHE
    base = os.path.join(os.path.dirname(__file__), "..", "kb")
    def _load(name: str):
        path = os.path.abspath(os.path.join(base, name))
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
        except Exception as exc:
            # Surface minimal error without crashing entire service
            return {"__error__": f"Failed to load {name}: {exc}"}
    _KB_CACHE = {
        "rules": _load("rules.json"),
        "lists": _load("lists.json"),
        "taxonomy": _load("taxonomy.json"),
    }
    return _KB_CACHE


def evaluate_kb_risk(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate KB-based risk from an input payload.

    Supports two input modes:
      - {"entity_id": "E123"}: Basic entity-centric evaluation (currently minimal).
      - {"transfers": [...], "beneficiary_name": "..."}: Transaction chain evaluation.

    Deterministic rules: if match condition satisfied, sets score to effect.score.
    Weighted rules: sum weights of matched feature flags; if >= threshold include category.
    """
    kb = load_kb()
    rules = kb.get("rules", {})
    lists = kb.get("lists", {})
    deterministic_rules = rules.get("deterministic", [])
    weighted_rules = rules.get("weighted", [])

    score = 0.0
    det_triggers: List[str] = []
    labels: List[str] = []
    matched_features_global: List[str] = []
    weighted_details: List[Dict[str, Any]] = []

    # Extract inputs
    transfers: List[Dict[str, Any]] = payload.get("transfers", [])
    beneficiary_name: str = payload.get("beneficiary_name", "")

    # Support entity-only evaluation (future expansion): currently just placeholder
    entity_id = payload.get("entity_id")
    entity_data: Dict[str, Any] = {}
    if entity_id:
        # Optionally fetch entity for future feature extraction
        try:
            entity_data = get_entity(entity_id) or {}
        except Exception:
            entity_data = {}
        # If no explicit transfers provided, derive a minimal set from graph transactions
        if not transfers:
            try:
                txs = get_transactions(entity_id, "both")
            except Exception:
                txs = []
            derived: List[Dict[str, Any]] = []
            for tx in txs:
                derived.append({
                    "from": tx.get("from_id") or tx.get("from"),
                    "to": tx.get("to_id") or tx.get("to"),
                    "amount_cny": tx.get("amount_cny") or tx.get("amount"),
                    "date": tx.get("time") or tx.get("date"),
                    "to_region": tx.get("to_region") or tx.get("region"),
                })
            # Limit to a recent window if very large (simple cap at 100 for MVP)
            transfers = derived[:100]

    # --- Deterministic phase ---
    sanctioned = beneficiary_name and beneficiary_name.upper() in {s.upper() for s in lists.get("sanctioned_parties", [])}
    for rule in deterministic_rules:
        match_cfg = rule.get("match", {})
        # Simple supported key: counterparty_name_in_sanctions
        if match_cfg.get("counterparty_name_in_sanctions") and sanctioned:
            det_triggers.append(rule.get("id", "unknown"))
            effect = rule.get("effect", {})
            score = max(score, float(effect.get("score", 0)))
            if rule.get("category") and rule["category"] not in labels:
                labels.append(rule["category"])

    # --- Weighted phase ---
    # Pre-compute features from transfers
    # Features: small_amount, multi_accounts, consecutive_days, same_beneficiary, total_volume, cross_border, same_offshore_beneficiary, frequency
    amounts = [t.get("amount_cny") or t.get("amount") for t in transfers if (t.get("amount_cny") or t.get("amount")) is not None]
    small_amount_flag = False
    multi_accounts_flag = False
    consecutive_days_flag = False
    same_beneficiary_flag = False
    total_volume_flag = False
    cross_border_flag = False
    same_offshore_beneficiary_flag = False
    frequency_flag = False

    if transfers:
        # Determine unique source accounts and beneficiary consistency
        from_accounts = {t.get("from") or t.get("from_id") for t in transfers if t.get("from") or t.get("from_id")}
        to_accounts = {t.get("to") or t.get("to_id") for t in transfers if t.get("to") or t.get("to_id")}
        # Multi accounts
        multi_accounts_flag = len(from_accounts) >= 3
        # Same beneficiary
        same_beneficiary_flag = len(to_accounts) == 1
        # Frequency: number of transfers per day threshold simplistic
        frequency_flag = len(transfers) >= 3
        # Amount checks
        if amounts:
            max_amount = max(amounts)
        else:
            max_amount = 0
        # Collect dates for consecutive detection
        dates = []
        for t in transfers:
            d = t.get("date") or t.get("time")
            if d:
                dates.append(str(d))
        if dates:
            # Sort and check consecutive (naive: count distinct days)
            distinct_days = sorted({d for d in dates})
            consecutive_days_flag = len(distinct_days) >= 5
        # Total volume (simple sum threshold usage later)
        total_volume = sum(amounts) if amounts else 0
        # Cross-border (regions differ or offshore region list involved)
        regions = [t.get("to_region") or t.get("region") for t in transfers if t.get("to_region") or t.get("region")]
        region_set = {r for r in regions if r}
        cross_border_flag = len(region_set) > 1
        offshore_list = set(lists.get("high_risk_regions", []))
        same_offshore_beneficiary_flag = bool(region_set) and all(r in offshore_list for r in region_set) and same_beneficiary_flag

    # Weighted rule evaluation
    for w_rule in weighted_rules:
        weights: Dict[str, float] = w_rule.get("weights", {})
        threshold = float(w_rule.get("threshold", 1.0))
        raw_score = 0.0
        matched_features: List[str] = []
        feature_weights_list: List[Dict[str, Any]] = []
        # Map feature name → flag
        feature_flags = {
            "small_amount": small_amount_flag,
            "multi_accounts": multi_accounts_flag,
            "consecutive_days": consecutive_days_flag,
            "same_beneficiary": same_beneficiary_flag,
            "total_volume": total_volume_flag,
            "cross_border": cross_border_flag,
            "same_offshore_beneficiary": same_offshore_beneficiary_flag,
            "frequency": frequency_flag,
        }
        # Derive small_amount_flag and total_volume_flag using hints
        hints = w_rule.get("hints", {})
        limit_small = hints.get("small_amount_cny_max")
        if limit_small is not None and amounts:
            small_amount_flag = max(amounts) <= float(limit_small)
            feature_flags["small_amount"] = small_amount_flag
        # total volume heuristic: if total >= 3*limit_small treat flagged
        if limit_small is not None and amounts:
            total_volume_flag = sum(amounts) >= (3 * float(limit_small))
            feature_flags["total_volume"] = total_volume_flag

        for fname, fflag in feature_flags.items():
            if fflag and fname in weights:
                raw_score += float(weights[fname])
                matched_features.append(fname)
                feature_weights_list.append({"name": fname, "weight": float(weights[fname])})

        passed = raw_score >= threshold
        weighted_details.append({
            "id": w_rule.get("id"),
            "category": w_rule.get("category"),
            "matched_features": matched_features,
            "raw_score": raw_score,
            "threshold": threshold,
            "passed": passed,
            "feature_weights": feature_weights_list,
        })
        if passed:
            cat = w_rule.get("category")
            if cat and cat not in labels:
                labels.append(cat)
            for mf in matched_features:
                if mf not in matched_features_global:
                    matched_features_global.append(mf)
            # Scale weighted raw score to percentage if higher than current deterministic score
            score = max(score, raw_score * 100)

    explanation_parts = []
    if det_triggers:
        explanation_parts.append("Deterministic triggers: " + ", ".join(det_triggers))
    if matched_features_global:
        explanation_parts.append("Matched features: " + ", ".join(matched_features_global))
    if not explanation_parts:
        explanation_parts.append("No rules matched")
    explanation = "; ".join(explanation_parts)

    return {
        "score": round(score, 2),
        "labels": labels,
        "deterministic_triggers": det_triggers,
        "matched_features": matched_features_global,
        "weighted_details": weighted_details,
        "explanation": explanation,
        "input_entity_id": entity_id,
        "input_transfer_count": len(transfers),
    }


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


def generate_risk_summary(entity_id: str, *, news_limit: int = 10, llm_temperature: float = 0.0) -> Dict[str, Any]:
    """Generate a concise risk summary for an entity using the LLM.

    Behavior:
      - Build a compact context using `analyze_entity_risks` output.
      - Try to call the configured LLM via `get_llm_client()`.
      - If LLM is unavailable (no API key or client error), fall back to a
        deterministic textual summary constructed from the analysis results.

    Returns a dict: {"summary_text": str, "model": opt, "usage": opt, "source": "llm"|"fallback"}
    """
    # Get structured analysis (local, deterministic)
    analysis = analyze_entity_risks(entity_id, news_limit=news_limit)
    if not analysis:
        return {"summary_text": "未找到实体或无可用数据。", "source": "fallback"}

    # Build compact context for LLM: entity, top labels, counts and first news titles
    ent = analysis.get("entity") or {}
    name = ent.get("name") or ent.get("id") or entity_id
    labels = analysis.get("summary", {})
    overall_score = analysis.get("summary", {}).get("overall_risk_score", 0)
    total_items = analysis.get("summary", {}).get("total_items", 0)
    total_risky = analysis.get("summary", {}).get("total_risky_items", 0)

    # collate news headlines (up to 3)
    news_items = analysis.get("news", {}).get("items", []) or []
    headlines = [n.get("title") or n.get("url") for n in news_items[:3]]

    # Create a succinct system + user prompt in Chinese asking for a short risk summary
    system_prompt = (
        "你是企业尽职调查助理。根据下列事实，生成一段中文风险分析总结（3-5句），要点化、可读且面向合规审查：不要引用原始数据，只给出结论和要点。"
    )
    facts = [
        f"实体: {name}",
        f"总体风险评分: {overall_score}",
        f"总项数: {total_items}, 其中可疑项: {total_risky}",
    ]
    # show top labels if any
    labels_list = analysis.get("labels") or []
    if labels_list:
        facts.append("风险标签: " + ", ".join(labels_list[:5]))
    if headlines:
        facts.append("近期新闻: " + " | ".join(headlines))

    user_prompt = "\n".join(["事实:", *facts, "\n请基于以上事实给出中文风险总结：\n- 概要\n- 关键风险要点（最多3条）\n- 建议的下一步（1条）"]) 

    # Try to call LLM; if unavailable, fall back to deterministic summary
    try:
        client = get_llm_client()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        text, usage, model = client.generate(messages, temperature=llm_temperature, max_tokens=400)
        if not text:
            raise RuntimeError("Empty LLM response")
        return {"summary_text": text, "model": model, "usage": usage or {}, "source": "llm"}
    except Exception as exc:  # fall back to deterministic summary
        # Build a readable fallback summary in Chinese
        parts: list[str] = []
        parts.append(f"摘要: 对于“{name}”，自动规则检测得到总体风险评分 {overall_score}（基于 {total_items} 个数据项，{total_risky} 个可疑项）。")
        top_labels = ", ".join(labels_list[:3]) if labels_list else "无显著标签"
        parts.append(f"主要发现: {top_labels}。")
        # extract simple counts from sections for suggested highlights
        highlights: list[str] = []
        if analysis.get("accounts", {}).get("risky_count", 0) > 0:
            highlights.append("账户异常")
        if analysis.get("transactions", {}).get("risky_count", 0) > 0:
            highlights.append("交易存在大额/高风险通道")
        if analysis.get("news", {}).get("risky_count", 0) > 0:
            highlights.append("负面新闻")
        if highlights:
            parts.append("可疑要点: " + ", ".join(highlights) + "。")
        else:
            parts.append("可疑要点: 未发现明显规则匹配的高风险要素。")
        if headlines:
            parts.append("相关新闻: " + (" | ".join(headlines)))
        parts.append("建议: 对可疑项进行人工复核，优先核查账户与大额交易，并检索更多新闻证据。")
        return {"summary_text": "\n".join(parts), "source": "fallback", "error": str(exc)}
