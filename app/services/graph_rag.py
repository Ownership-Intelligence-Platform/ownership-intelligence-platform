"""Minimal GraphRAG service implementing a hybrid resolver for name+dob queries.

This module provides a small, self-contained MVP that combines the existing
fuzzy search in `graph_service` with optional embedding-based semantic matching
using `llm_client`. It does not require an external vector DB: embeddings are
computed on-the-fly for the small candidate set returned by fuzzy search.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
import logging
import math

from app.services.graph_service import search_entities_fuzzy, get_entity, get_layers
from app.services.llm_client import get_llm_client

logger = logging.getLogger(__name__)


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return sum(x * y for x, y in zip(a, b)) / (na * nb)


def _build_node_text(item: Dict[str, Any]) -> str:
    parts: List[str] = []
    if item.get("name"):
        parts.append(str(item.get("name")))
    for k in ("type", "description", "id", "id_info"):
        v = item.get(k)
        if v:
            parts.append(str(v))
    # include basic_info if present
    bi = item.get("basic_info")
    if bi:
        try:
            parts.append(str(bi))
        except Exception:
            pass
    return " | ".join(parts)


def resolve_graphrag(
    *,
    name: Optional[str] = None,
    birth_date: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
    use_semantic: bool = True,
    top_k: int = 5,
) -> Dict[str, Any]:
    """Resolve a query using fuzzy + optional semantic retrieval.

    Returns a dict with `candidates` (list) and optional `subgraphs` for top items.
    """
    # Use name-only for fuzzy search to avoid polluting the query string with DOB or other fields.
    q_text = (name or "").strip()

    # Step 1: fuzzy search by name/id/description
    candidates = search_entities_fuzzy(q_text, limit=max(10, top_k * 3)) if q_text else []

    if not candidates:
        return {
            "query": {"name": name, "birth_date": birth_date, "extra": extra, "use_semantic": use_semantic},
            "candidates": [],
        }

    # compute fuzzy-normalized scores (search_entities_fuzzy uses integer tiers up to 4)
    for c in candidates:
        raw = float(c.get("score") or 0.0)
        c["_fuzzy_norm"] = min(1.0, raw / 4.0)

    sem_sims: Optional[List[float]] = None
    if use_semantic and candidates:
        try:
            client = get_llm_client()
            query_text = q_text or (name or "")
            node_texts = [_build_node_text(c) for c in candidates]
            texts = [query_text] + node_texts
            embs = client.embed(texts)
            if embs and len(embs) == len(texts):
                qvec = embs[0]
                sem_sims = []
                for i in range(1, len(embs)):
                    sim = _cosine(qvec, embs[i])
                    sem_sims.append(sim)
            else:
                logger.warning("Embedding returned empty or unexpected length, falling back to fuzzy only")
        except Exception as exc:  # pragma: no cover - depends on runtime config
            logger.exception("Embedding failed, continuing with fuzzy-only: %s", exc)
            sem_sims = None

    results: List[Dict[str, Any]] = []
    for idx, c in enumerate(candidates):
        fuzzy_score = float(c.get("_fuzzy_norm") or 0.0)
        sem_score = 0.0
        if sem_sims is not None and idx < len(sem_sims):
            # cosine ranges [-1,1], map to [0,1]
            sem_score = (float(sem_sims[idx]) + 1.0) / 2.0
        # dob and address bonuses: look for exact birth_date and address keyword matches
        dob_bonus = 0.0
        address_bonus = 0.0
        matched_fields: List[str] = []
        if birth_date:
            try:
                # direct property (if importer stored it on the node)
                if isinstance(c.get("basic_info"), dict):
                    bi = c["basic_info"]
                    if str(bi.get("birth_date") or "") == birth_date:
                        dob_bonus = 0.3
                        matched_fields.append("birth_date")
                # fallback: id_info may embed date or id number with encoded DOB
                if dob_bonus == 0.0 and isinstance(c.get("id_info"), dict):
                    ii = c["id_info"]
                    for v in ii.values():
                        if isinstance(v, str) and birth_date in v:
                            dob_bonus = 0.15
                            matched_fields.append("id_info_match")
                            break
            except Exception:
                dob_bonus = dob_bonus

        # address keyword matching (from extra.address_keywords)
        try:
            kws = []
            if extra and isinstance(extra.get("address_keywords"), list):
                kws = [str(x).strip().lower() for x in extra.get("address_keywords") if x]
            if kws:
                # check residential address and geo_profile countries
                ra = ""
                if isinstance(c.get("basic_info"), dict):
                    ra = str(c["basic_info"].get("residential_address") or "").lower()
                geo_countries = []
                if isinstance(c.get("geo_profile"), dict):
                    geo_countries = [str(x).lower() for x in (c["geo_profile"].get("countries_recent_6m") or [])]
                # track keyword -> source for friendlier matched_fields
                matched_addr = {}
                for kw in kws:
                    if not kw:
                        continue
                    if kw in ra:
                        matched_addr[kw] = "basic_info"
                        continue
                    for ct in geo_countries:
                        if kw in ct:
                            matched_addr[kw] = "geo_profile"
                            break
                if matched_addr:
                    # small bonus per matched keyword, capped
                    address_bonus = 0.1 * len(matched_addr)
                    if address_bonus > 0.3:
                        address_bonus = 0.3
                    for m in sorted(matched_addr.keys()):
                        src = matched_addr.get(m) or "unknown"
                        # append a friendlier entry with source info
                        matched_fields.append(f"address:{m} ({src})")
        except Exception:
            address_bonus = 0.0

        # weighting: prefer semantic when available
        if sem_sims is not None:
            final = 0.6 * sem_score + 0.4 * fuzzy_score + dob_bonus + address_bonus
        else:
            final = 1.0 * fuzzy_score + dob_bonus + address_bonus

        # Normalize composite into a stable 0..1 range for UI (max possible
        # final value is ~1.6 when dob_bonus=0.3, address_bonus=0.3 and other
        # scores are near 1.0).
        max_possible = 1.6
        try:
            normalized_score = float(final) / float(max_possible) if max_possible else float(final)
        except Exception:
            normalized_score = float(final)
        if normalized_score < 0:
            normalized_score = 0.0
        if normalized_score > 1.0:
            normalized_score = 1.0

        results.append(
            {
                "node_id": c.get("id"),
                "labels": ["Person"] if (c.get("type") or "").lower() == "person" else [c.get("type")],
                "name": c.get("name"),
                "score": min(1.0, float(final)),
                "fuzzy_score": float(fuzzy_score),
                "semantic_score": float(sem_score),
                "composite_score": float(final),
                "normalized_score": float(normalized_score),
                "matched_fields": matched_fields,
                "evidence": _build_node_text(c),
                "_raw": c,
            }
        )

    # sort and pick top_k
    # Sort primarily by normalized_score (0..1) to surface candidates that
    # rank higher after accounting for DOB bonuses and semantic similarity.
    # Use composite_score as a tiebreaker for stability.
    results = sorted(
        results,
        key=lambda r: (
            float(r.get("normalized_score", 0.0)),
            float(r.get("composite_score", 0.0)),
        ),
        reverse=True,
    )[:top_k]

    # attach small subgraph for top candidate(s)
    subgraphs: Dict[str, Any] = {}
    for r in results[: min(2, len(results))]:
        nid = r.get("node_id")
        try:
            # get_layers returns structured layers for UI; use depth=1 for small context
            sg = get_layers(nid, depth=1)
            subgraphs[nid] = sg
        except Exception:
            subgraphs[nid] = None

    return {
        "query": {"name": name, "birth_date": birth_date, "extra": extra, "use_semantic": use_semantic},
        "candidates": results,
        "subgraphs": subgraphs,
    }
