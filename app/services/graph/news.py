from typing import Dict, Any, List, Optional
from app.db.neo4j_connector import run_cypher


def create_news_item(
    entity_id: str,
    title: Optional[str] = None,
    url: Optional[str] = None,
    source: Optional[str] = None,
    published_at: Optional[str] = None,
    summary: Optional[str] = None,
) -> Dict[str, Any]:
    """Create or update a News node and link it to an Entity via HAS_NEWS."""
    if not entity_id:
        return {}
    if url:
        query = (
            "MATCH (e:Entity {id: $eid}) "
            "MERGE (n:News {url: $url}) "
            "SET n.title = coalesce($title, n.title), "
            "    n.source = coalesce($source, n.source), "
            "    n.published_at = coalesce($published_at, n.published_at), "
            "    n.summary = coalesce($summary, n.summary) "
            "MERGE (e)-[:HAS_NEWS]->(n) "
            "RETURN n.title AS title, n.url AS url, n.source AS source, n.published_at AS published_at, n.summary AS summary"
        )
        params = {
            "eid": entity_id,
            "title": title,
            "url": url,
            "source": source,
            "published_at": published_at,
            "summary": summary,
        }
    else:
        query = (
            "MATCH (e:Entity {id: $eid}) "
            "MERGE (n:News {title: $title, published_at: $published_at}) "
            "SET n.source = coalesce($source, n.source), n.summary = coalesce($summary, n.summary) "
            "MERGE (e)-[:HAS_NEWS]->(n) "
            "RETURN n.title AS title, n.url AS url, n.source AS source, n.published_at AS published_at, n.summary AS summary"
        )
        params = {
            "eid": entity_id,
            "title": title,
            "published_at": published_at,
            "source": source,
            "summary": summary,
        }
    res = run_cypher(query, params)
    return res[0] if res else {}


def get_stored_news(entity_id: str) -> List[Dict[str, Any]]:
    """Return stored news items linked to the entity."""
    if not entity_id:
        return []
    query = (
        "MATCH (e:Entity {id: $id}) "
        "OPTIONAL MATCH (e)-[:HAS_NEWS]->(n:News) "
        "RETURN collect({title: n.title, url: n.url, source: n.source, published_at: n.published_at, summary: n.summary}) AS items"
    )
    res = run_cypher(query, {"id": entity_id})
    if not res:
        return []
    items = res[0].get("items") or []
    cleaned = [i for i in items if any(v for v in i.values())]
    return cleaned
