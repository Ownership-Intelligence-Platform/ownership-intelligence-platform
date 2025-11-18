from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Tuple

from app.services.llm_client import get_llm_client
from app.services.name_screening_service import screen_name_against_watchlist


def _extract_json(text: str) -> Dict[str, Any]:
    """Best-effort JSON extraction from LLM output.

    Handles common cases like fenced code blocks and extra prose.
    """
    s = (text or "").strip()
    if not s:
        return {}
    # Remove code fences if present
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n|\n```$", "", s).strip()
    # Try direct json
    try:
        return json.loads(s)
    except Exception:
        pass
    # Fallback: find first {...} or [...] block
    m = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", s)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            return {}
    return {}


def expand_name_variants(
    name: str,
    *,
    locales: List[str] | None = None,
    include_pinyin: bool = True,
    max_candidates: int = 10,
) -> Dict[str, Any]:
    """Use an LLM to propose alias/transliteration/multilingual variants for a name.

    Returns a dict including structured variants and a small trace suitable for UI rendering.
    """
    locales = locales or ["zh", "en"]
    q = (name or "").strip()
    if not q:
        return {"canonical": "", "variants": [], "trace": ["empty input"], "model": None, "usage": {}}

    trace: List[str] = []

    # Compose a concise structured prompt
    system = (
        "You generate plausible name variants for screening. Return STRICT JSON only. "
        "Do NOT include comments or explanations."
    )
    user = {
        "task": "name_variant_generation",
        "input_name": q,
        "locales": locales,
        "include_pinyin": bool(include_pinyin),
        "max_candidates": int(max_candidates),
        "types": [
            "alias",
            "transliteration",
            "pinyin",
            "latinization",
            "westernized",
            "spacing",
            "punctuation",
            "abbreviation",
            "bilingual",
            "other",
        ],
        "output_schema": {
            "canonical": "string",
            "variants": [
                {
                    "value": "string",
                    "type": "alias|transliteration|pinyin|latinization|westernized|spacing|punctuation|abbreviation|bilingual|other",
                    "locale": "string (e.g., zh, en)",
                    "confidence": "0.0-1.0"
                }
            ]
        },
        "constraints": [
            "Only plausible variants; avoid hallucinated identities.",
            "Max 10 variants.",
            "If unsure, prefer pinyin and spacing variants."
        ],
        "examples": [
            {
                "name": "张三",
                "variants": [
                    {"value": "Zhang San", "type": "pinyin", "locale": "en", "confidence": 0.95},
                    {"value": "Zhangsan", "type": "spacing", "locale": "en", "confidence": 0.6},
                    {"value": "張三", "type": "alias", "locale": "zh", "confidence": 0.7}
                ]
            }
        ]
    }

    try:
        client = get_llm_client()
        text, usage, model = client.generate(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
            ],
            temperature=0.1,
            max_tokens=600,
        )
        trace.append("LLM called for variant expansion")
        data = _extract_json(text)
        if not isinstance(data, dict):
            data = {}
        canonical = (data.get("canonical") or q).strip()
        raw_vars = data.get("variants") or []
        variants: List[Dict[str, Any]] = []
        for v in raw_vars:
            val = (v.get("value") or "").strip() if isinstance(v, dict) else ""
            if not val or val == canonical:
                continue
            vtype = (v.get("type") or "other").strip().lower() if isinstance(v, dict) else "other"
            loc = (v.get("locale") or "").strip() if isinstance(v, dict) else ""
            try:
                conf = float(v.get("confidence", 0.5))
            except Exception:
                conf = 0.5
            variants.append({
                "value": val,
                "type": vtype,
                "locale": loc,
                "confidence": max(0.0, min(1.0, conf)),
            })
        # Deduplicate by value
        seen = set()
        deduped: List[Dict[str, Any]] = []
        for v in variants:
            key = v["value"].lower().replace(" ", "")
            if key in seen:
                continue
            seen.add(key)
            deduped.append(v)
        return {
            "canonical": canonical,
            "variants": deduped[: max_candidates],
            "usage": usage or {},
            "model": model,
            "trace": trace,
        }
    except Exception as exc:
        # Graceful fallback when LLM is not available
        trace.append(f"LLM unavailable or failed: {exc}")
        return {
            "canonical": q,
            "variants": [],
            "usage": {},
            "model": None,
            "trace": trace,
            "error": str(exc),
        }


def match_watchlist_with_variants(
    name: str,
    variants: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Run watchlist screening for each variant; annotate hits with the variant used.

    Deduplicate hits by (name, list, type) keeping the highest score.
    """
    agg: List[Dict[str, Any]] = []
    for v in variants:
        q = v.get("value") or ""
        if not q:
            continue
        hits = screen_name_against_watchlist(q)
        for h in hits:
            h2 = dict(h)
            h2["via_variant"] = {"value": q, "type": v.get("type")}
            agg.append(h2)

    # Deduplicate
    best: Dict[Tuple[Any, Any, Any], Dict[str, Any]] = {}
    for h in agg:
        key = (h.get("name"), h.get("list"), h.get("type"))
        old = best.get(key)
        if not old or int(h.get("score") or 0) > int(old.get("score") or 0):
            best[key] = h
    return sorted(best.values(), key=lambda r: (-int(r.get("score") or 0), str(r.get("name") or "")))
