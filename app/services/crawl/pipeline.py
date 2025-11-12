from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Dict, Iterable, List, Tuple

from .base import canonical_json, sha256_hexdigest


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _record_dedupe_key(rec: Dict) -> Tuple[str, str]:
    # Default dedupe: (source_site, content_hash)
    meta_site = str(rec.get("meta_source_site") or "")
    # Compute hash if not present
    content_hash = rec.get("meta_content_hash")
    if not content_hash:
        content_hash = sha256_hexdigest(canonical_json(rec))
        rec["meta_content_hash"] = content_hash
    return meta_site, content_hash


def write_jsonl(records: Iterable[Dict], out_dir: str, filename_prefix: str) -> str:
    """Write records to a JSONL file with coarse dedupe by (source_site, content_hash).

    Returns the path to the written file. Existing file will be appended.
    """
    ensure_dir(out_dir)
    dt = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(out_dir, f"{filename_prefix}-{dt}.jsonl")

    seen: set = set()
    with open(path, "a", encoding="utf-8") as f:
        for rec in records:
            key = _record_dedupe_key(rec)
            if key in seen:
                continue
            seen.add(key)
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return path
