"""External enrichment service (mock providers + optional web citations).

Usage:
- enrich_person(name, birthdate, k_providers=3, add_web_citations=True)

Return schema (JSON-serializable):
{
  "ok": true,
  "source": "external",
  "query": {"name": str, "birthdate": str | None},
  "providers": [
    {
      "name": str,              # e.g., "Qichacha"
      "type": str,              # e.g., "business-registry" | "legal-judgment"
      "matches": [              # best-effort matched items
        {
          "id": str | None,
          "name": str | None,
          "birthdate": str | None,
          "score": float | None,   # mock confidence score 0-1
          "summary": str | None,
          "source_url": str | None
        }, ...
      ]
    }, ...
  ],
  "summary": str | None,
  "citations": [{"title": str | None, "url": str}],
}

Notes:
- Real integrations (Qichacha, Tianyancha, 裁判文书网等) typically require APIs, auth, anti-bot handling.
  This module supplies deterministic mocked data and optional generic web search citations so that
  the UI can be built now and backend can be swapped later.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional
from datetime import datetime

from .web_search_service import WebSearch
from .llm_client import get_llm_client  # may raise at runtime; handle in caller


def _norm_birthdate(b: Optional[str]) -> Optional[str]:
    if not b:
        return None
    s = str(b).strip()
    if not s:
        return None
    # try a few common formats
    fmts = ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d", "%Y.%m.%d"]
    for f in fmts:
        try:
            dt = datetime.strptime(s, f)
            return dt.strftime("%Y-%m-%d")
        except Exception:
            continue
    # best-effort: return original
    return s


@dataclass
class _ProviderResult:
    name: str
    type: str
    matches: List[Dict]


class _BaseMockProvider:
    provider_name: str = "mock"
    provider_type: str = "generic"

    def search(self, name: str, birthdate: Optional[str]) -> _ProviderResult:
        raise NotImplementedError


class QichachaMockProvider(_BaseMockProvider):
    provider_name = "Qichacha"
    provider_type = "business-registry"

    def search(self, name: str, birthdate: Optional[str]) -> _ProviderResult:
        # Deterministic mock: fabricate 1-2 potential matches
        bd_label = birthdate or "未知生日"
        matches = [
            {
                "id": None,
                "name": name,
                "birthdate": birthdate,
                "score": 0.78,
                "summary": f"在企查查检索到同名人员，生日为{bd_label}，涉及若干家企业的关联关系（模拟数据）。",
                "source_url": "https://www.qcc.com/",
            }
        ]
        return _ProviderResult(self.provider_name, self.provider_type, matches)


class TianyanchaMockProvider(_BaseMockProvider):
    provider_name = "Tianyancha"
    provider_type = "business-registry"

    def search(self, name: str, birthdate: Optional[str]) -> _ProviderResult:
        matches = [
            {
                "id": None,
                "name": name,
                "birthdate": birthdate,
                "score": 0.72,
                "summary": "在天眼查发现可能的高管或法定代表人记录（模拟数据）。",
                "source_url": "https://www.tianyancha.com/",
            }
        ]
        return _ProviderResult(self.provider_name, self.provider_type, matches)


class CnJudgmentMockProvider(_BaseMockProvider):
    provider_name = "ChinaJudgments"
    provider_type = "legal-judgment"

    def search(self, name: str, birthdate: Optional[str]) -> _ProviderResult:
        matches = [
            {
                "id": None,
                "name": name,
                "birthdate": birthdate,
                "score": 0.35,
                "summary": "在公开法律文书检索平台可能存在同名当事人（模拟数据，仅供参考）。",
                "source_url": "https://wenshu.court.gov.cn/",
            }
        ]
        return _ProviderResult(self.provider_name, self.provider_type, matches)


def _providers() -> List[_BaseMockProvider]:
    return [QichachaMockProvider(), TianyanchaMockProvider(), CnJudgmentMockProvider()]


def enrich_person(
    name: str,
    birthdate: Optional[str] = None,
    *,
    add_web_citations: bool = True,
    k_citations: int = 3,
) -> Dict:
    """Aggregate external info from several providers (mocked) and optional web citations."""
    name = (name or "").strip()
    if not name:
        return {"ok": False, "source": "external", "error": "name_required"}
    bnorm = _norm_birthdate(birthdate)

    providers_out: List[Dict] = []
    for p in _providers():
        try:
            pr = p.search(name, bnorm)
            providers_out.append({
                "name": pr.name,
                "type": pr.type,
                "matches": pr.matches,
            })
        except Exception:
            # Best-effort: skip provider failures
            continue

    # Lightweight summary for UI
    total_matches = sum(len(p["matches"]) for p in providers_out)
    summary = f"为姓名“{name}”{('，生日 ' + bnorm) if bnorm else ''}聚合到 {total_matches} 条外部候选（模拟），来源：" + \
              ", ".join(p["name"] for p in providers_out)

    citations: List[Dict] = []
    if add_web_citations:
        try:
            ws = WebSearch(timeout=5.0, provider="auto")
            # Simple query; in future could include site filters
            q = f"{name} {bnorm or ''}"
            hits = ws.search(q.strip(), k=max(1, k_citations))
            for h in hits:
                if h.get("url"):
                    citations.append({"title": h.get("title"), "url": h.get("url")})
        except Exception:
            citations = []

    return {
        "ok": True,
        "source": "external",
        "query": {"name": name, "birthdate": bnorm},
        "providers": providers_out,
        "summary": summary,
        "citations": citations,
    }


def analyze_enrichment(
    enrichment: Dict,
    *,
    use_web_content: bool = False,
    max_citations: int = 3,
) -> Dict:
    """Run an LLM analysis over the enrichment bundle to produce summary, income estimate, and risk tips.

    Falls back to a deterministic mock when LLM is unavailable.
    """
    name = (enrichment.get("query") or {}).get("name") or ""
    bday = (enrichment.get("query") or {}).get("birthdate") or None
    providers = enrichment.get("providers") or []
    citations = (enrichment.get("citations") or [])[: max_citations]

    # Optionally pull minimal content to enrich the context
    contents: List[str] = []
    if use_web_content and citations:
        try:
            ws = WebSearch(timeout=6.0, provider="auto", max_content_chars=1200)  # type: ignore
            for c in citations:
                url = c.get("url")
                if not url:
                    continue
                txt = ws.fetch_content(url)
                if txt:
                    contents.append(f"URL: {url}\nContent: {txt}")
        except Exception:
            contents = []

    # Try LLM
    try:
        client = get_llm_client()
        # Build compact provider snapshot
        provider_lines = []
        for p in providers:
            pfx = f"- {p.get('name') or 'provider'} ({p.get('type') or ''})"
            ms = p.get("matches") or []
            if ms:
                # include up to 2 matches per provider
                for m in ms[:2]:
                    nm = (m.get("name") or "?")
                    bd = (m.get("birthdate") or "?")
                    sc = m.get("score")
                    sm = (m.get("summary") or "")[:180]
                    provider_lines.append(f"{pfx}: {nm} · {bd} · score={sc} · {sm}")
            else:
                provider_lines.append(f"{pfx}: no matches")

        cite_lines = []
        for c in citations:
            url = c.get("url")
            title = c.get("title") or url
            cite_lines.append(f"- {title} | {url}")

        sys = {
            "role": "system",
            "content": (
                "You are a precise analyst for due diligence. Reply in JSON only. "
                "Use only the provided facts and citations; do not fabricate links."
            ),
        }
        user = {
            "role": "user",
            "content": (
                f"Target person: {name} {'('+bday+')' if bday else ''}.\n"
                f"Providers:\n{chr(10).join(provider_lines) or 'none'}\n\n"
                f"Citations:\n{chr(10).join(cite_lines) or 'none'}\n\n"
                f"Context extracts (optional):\n{chr(10).join(contents) or 'none'}\n\n"
                "Task: Return strict JSON with keys: \n"
                "{\n  'summary': str,\n  'income': { 'estimate_cny_per_year': str, 'assumptions': str, 'references': [{'title': str, 'url': str}] },\n  'risks': { 'items': [ { 'type': 'legal'|'political'|'other', 'description': str, 'severity': 'low'|'medium'|'high', 'url': str } ], 'notes': str }\n}\n"
                "- If insufficient data, be conservative and say 'unknown' or 'insufficient evidence'.\n"
                "- Only cite URLs provided in Citations."
            ),
        }
        text, usage, model = client.generate([sys, user], temperature=0.2, max_tokens=900)
        # Best-effort parse JSON
        import json

        try:
            parsed = json.loads(text)
            if not isinstance(parsed, dict):
                raise ValueError("not a dict")
        except Exception:
            parsed = {
                "summary": text.strip()[:800],
                "income": {"estimate_cny_per_year": "unknown", "assumptions": "LLM returned non-JSON.", "references": citations},
                "risks": {"items": [], "notes": "LLM returned non-JSON."},
            }
        return {"ok": True, "model": model, "usage": usage, **parsed}
    except Exception:
        # Fallback deterministic mock
        est = "unknown"
        assumptions = "Insufficient structured position data; using placeholder (mock)."
        risks = []
        notes = "No concrete legal or political risks identified from mock providers."
        return {
            "ok": True,
            "model": "mock",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "summary": f"关于{name}的摘要（模拟）：基于外部公开检索获取的若干候选与参考链接，暂无可确认的关键信息。",
            "income": {
                "estimate_cny_per_year": est,
                "assumptions": assumptions,
                "references": citations,
            },
            "risks": {
                "items": risks,
                "notes": notes,
            },
        }
