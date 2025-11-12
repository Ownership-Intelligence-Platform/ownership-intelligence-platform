from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, asdict
from typing import Any, Dict, Iterable, List, Optional


def canonical_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_hexdigest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass
class SourceMeta:
    source_site: str
    source_url: Optional[str]
    fetched_at: str  # ISO8601
    parser: str
    content_hash: Optional[str] = None


@dataclass
class NewsRecord:
    entity_id: str
    title: Optional[str]
    url: Optional[str]
    source: Optional[str]
    published_at: Optional[str]
    summary: Optional[str]
    meta: SourceMeta

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        # Flatten meta for easier downstream processing
        meta = d.pop("meta", {})
        for k, v in (meta or {}).items():
            d[f"meta_{k}"] = v
        return d


class Spider:
    """Minimal spider contract.

    Subclasses should implement fetch() to return a list of normalized records
    (dicts or dataclasses with .to_dict()).
    """

    name: str = "base"

    def fetch(self, *args, **kwargs) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @staticmethod
    def normalize_records(items: Iterable[Any]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for x in items:
            if hasattr(x, "to_dict"):
                out.append(x.to_dict())
            elif isinstance(x, dict):
                out.append(x)
            else:
                raise TypeError(f"Unsupported record type: {type(x)}")
        return out
