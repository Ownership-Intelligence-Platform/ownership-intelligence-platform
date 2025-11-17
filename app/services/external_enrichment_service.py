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
