from __future__ import annotations

"""Shanghai Stock Exchange (SSE) Top-10 Shareholders spider (configurable).

This spider is designed to parse a Top-10 shareholders disclosure for an SSE-listed
company. Real SSE portals often expose JSON endpoints behind their disclosure pages;
to keep this generic and robust, we support:
- fetch_from_api(stock_code, api_url_template=...)
- parse_json(...) for unit tests or local snapshots

Normalization:
- Emits OwnershipRecord: owner_id = holder name (or id if present), owned_id = company entity id
- stake: percentage 0..100 (if ratio 0..1 is provided, it's converted to percent)

Note: For production, confirm the exact official endpoint/TOS and plug its JSON
shape by adjusting the field selectors below or passing a transform function.
"""

from typing import Any, Dict, List, Optional, Tuple, Callable

import httpx

from ..base import OwnershipRecord, SourceMeta, Spider
import time
import json


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class SseTop10Spider(Spider):
    name = "sse_top10"

    def __init__(
        self,
        *,
        timeout: float = 12.0,
        headers: Optional[Dict[str, str]] = None,
        # A transform hook to adapt arbitrary JSON shapes into a canonical list
        # of dicts: [{"holder_name": str, "ratio": float or str}, ...]
        transform: Optional[Callable[[Dict[str, Any]], List[Dict[str, Any]]]] = None,
    ) -> None:
        self.timeout = float(timeout)
        self.headers = headers or {"User-Agent": "OIP-Crawler/0.1"}
        self.transform = transform

    # --- Public API ---
    def fetch_from_api(self, entity_id: str, stock_code: str, *, api_url: str) -> List[Dict]:
        """Fetch top-10 holders via a JSON API endpoint.

        api_url should be a fully resolved URL that returns JSON.
        """
        data = self._get_json(api_url)
        return self.parse_json(entity_id=entity_id, payload=data, source_url=api_url)

    def parse_json(self, *, entity_id: str, payload: Dict[str, Any], source_url: str) -> List[Dict]:
        fetched = _now_iso()
        items: List[Dict[str, Any]]
        if self.transform:
            try:
                items = self.transform(payload)  # type: ignore[assignment]
            except Exception:
                items = []
        else:
            # Default heuristic: look for a list under common keys
            items = self._default_extract_items(payload)

        out: List[Dict] = []
        for it in items:
            name = (it.get("holder_name") or it.get("name") or it.get("shareholder") or "").strip()
            if not name:
                continue
            ratio = it.get("ratio") or it.get("percent") or it.get("hold_ratio")
            stake = self._parse_ratio(ratio)
            meta = SourceMeta(
                source_site="sse_top10",
                source_url=source_url,
                fetched_at=fetched,
                parser=self.name,
            )
            rec = OwnershipRecord(owner_id=name, owned_id=entity_id, stake=stake, meta=meta).to_dict()
            out.append(rec)
        return out

    # --- Internals ---
    def _get_json(self, url: str) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
                r = client.get(url)
                r.raise_for_status()
                return r.json()
        except Exception:
            return {}

    @staticmethod
    def _default_extract_items(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        # Try common shapes: { data: [...] } or { result: [...] } or direct list
        if isinstance(payload, list):
            return payload  # type: ignore[return-value]
        for key in ("data", "result", "items", "records", "list"):
            v = payload.get(key)
            if isinstance(v, list):
                return v  # type: ignore[return-value]
        # Try nested { data: { list: [...] } }
        data = payload.get("data")
        if isinstance(data, dict):
            for key in ("list", "items", "records"):
                v = data.get(key)
                if isinstance(v, list):
                    return v  # type: ignore[return-value]
        return []

    @staticmethod
    def _parse_ratio(val: Any) -> Optional[float]:
        if val is None:
            return None
        try:
            if isinstance(val, str):
                t = val.strip().replace("％", "%")
                if t.endswith("%"):
                    return float(t.rstrip("% "))
                # If numeric string without %, decide if ratio or percent
                num = float(t)
                return num * 100.0 if 0 <= num <= 1 else num
            if isinstance(val, (int, float)):
                num = float(val)
                return num * 100.0 if 0 <= num <= 1 else num
        except Exception:
            return None
        return None
