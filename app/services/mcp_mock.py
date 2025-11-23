from typing import List, Dict, Optional
import random


def _score_from_name(query_name: str, candidate_name: str) -> float:
    if not query_name:
        return random.uniform(0.2, 0.6)
    q = query_name.replace(" ", "").lower()
    c = candidate_name.replace(" ", "").lower()
    if q == c:
        return 0.95
    if q in c or c in q:
        return 0.8 + random.uniform(-0.05, 0.05)
    # partial token overlap
    qtokens = set([t for t in q.split() if t])
    ctokens = set([t for t in c.split() if t])
    if qtokens & ctokens:
        return 0.6 + random.uniform(-0.1, 0.1)
    return random.uniform(0.25, 0.55)


def mcp_search(
    query: str,
    parsed: Optional[Dict] = None,
    sources: Optional[List[str]] = None,
    top_k: int = 5,
) -> List[Dict]:
    """
    Mock MCP search across configured external sources.

    Returns a list of dicts: {source, id, name, snippet, url, match_score}
    """
    q = (query or "").strip()
    parsed_name = None
    addr_kw = []
    try:
        if parsed and isinstance(parsed, dict):
            parsed_name = parsed.get("name")
            addr_kw = parsed.get("address_keywords") or []
    except Exception:
        parsed_name = None

    # List of mock providers (order does not imply priority)
    providers = ["qichacha", "tianyancha", "gsxt", "wangpan", "news"]
    if sources:
        # allow front-end to restrict sources
        providers = [s for s in providers if s in sources]
    results = []

    # Create a few synthetic candidate hits using parsed name and small variations
    base_candidates = []
    if parsed_name:
        base_candidates.append(parsed_name)
        base_candidates.append(parsed_name + " (陕西)")
        base_candidates.append("李" + parsed_name[-2:])
    # also include tokens from query
    tokens = [t.strip() for t in q.replace("，", " ").split() if t.strip()]
    for t in tokens[:2]:
        if t and t not in base_candidates:
            base_candidates.append(t)

    if not base_candidates:
        base_candidates = [q or "结果1", "结果2"]

    # build mock results
    for i, cand in enumerate(base_candidates):
        provider = providers[i % len(providers)]
        name = cand
        snippet = f"从 {provider} 检索到的摘要：关于 {name} 的公开记录（示例）。"
        score = _score_from_name(parsed_name or q, name)
        # boost if address keyword appears
        if addr_kw:
            for k in addr_kw:
                if k and k in snippet:
                    score = min(1.0, score + 0.08)
        results.append(
            {
                "source": provider,
                "id": f"{provider}-{i+1}",
                "name": name,
                "snippet": snippet,
                "url": f"https://mock.{provider}.example/{i+1}",
                "match_score": round(score, 3),
            }
        )

    # add some random additional seeds
    while len(results) < min(top_k, 6):
        i = len(results) + 1
        p = random.choice(providers)
        name = f"候选 {i} ({p})"
        results.append(
            {
                "source": p,
                "id": f"{p}-{i}",
                "name": name,
                "snippet": f"来自 {p} 的示例结果 {i}",
                "url": f"https://mock.{p}.example/{i}",
                "match_score": round(random.uniform(0.25, 0.6), 3),
            }
        )

    # sort by match_score desc
    results = sorted(results, key=lambda r: r.get("match_score", 0), reverse=True)
    return results[:top_k]
