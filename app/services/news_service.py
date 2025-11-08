"""News retrieval service.

This module provides a small abstraction to fetch recent news articles for a given
company name. It prefers a JSON API (NewsAPI.org) when an API key is available via
the NEWSAPI_KEY environment variable; otherwise it falls back to parsing Google News
RSS feeds which require no API key.

No external Python dependencies are required; it uses the standard library.
"""

from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple, Callable


NewsItem = Dict[str, Any]


def _http_get(url: str, *, timeout: float = 8.0, headers: Optional[Dict[str, str]] = None) -> Tuple[int, bytes]:
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # nosec - URL constructed from known endpoints
        return resp.getcode(), resp.read()


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def get_company_news(
    company_name: str,
    *,
    limit: int = 10,
    http_get: Callable[[str], Tuple[int, bytes]] = None,
) -> List[NewsItem]:
    """Fetch news for a company.

    Args:
        company_name: The search query, typically the entity/company name.
        limit: Max number of items (1..50).
        http_get: Optional injectable HTTP getter for testing; signature (url) -> (status, bytes).

    Returns:
        A list of normalized news items: {title, url, source, published_at, summary}.
    """
    if not company_name:
        return []
    limit = max(1, min(int(limit or 10), 50))

    _getter = http_get or (lambda url: _http_get(url))

    api_key = os.getenv("NEWSAPI_KEY") or os.getenv("NEWS_API_KEY")
    if api_key:
        items = _fetch_via_newsapi(company_name, limit, api_key, _getter)
        if items:
            return items[:limit]

    # Fallback to Google News RSS
    items = _fetch_via_google_news_rss(company_name, limit, _getter)
    return items[:limit]


def _fetch_via_newsapi(
    query: str,
    limit: int,
    api_key: str,
    http_get: Callable[[str], Tuple[int, bytes]],
) -> List[NewsItem]:
    base = "https://newsapi.org/v2/everything"
    params = {
        "q": query,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": str(limit),
        "apiKey": api_key,
    }
    url = f"{base}?{urllib.parse.urlencode(params)}"
    try:
        status, body = http_get(url)
        if status != 200:
            return []
        data = json.loads(body.decode("utf-8", errors="ignore"))
    except Exception:
        return []

    arts = data.get("articles") or []
    items: List[NewsItem] = []
    for a in arts:
        items.append(
            {
                "title": (a.get("title") or "").strip(),
                "url": a.get("url"),
                "source": ((a.get("source") or {}).get("name") or None),
                "published_at": a.get("publishedAt") or _now_iso(),
                "summary": (a.get("description") or "").strip() or None,
            }
        )
    return items


def _fetch_via_google_news_rss(
    query: str,
    limit: int,
    http_get: Callable[[str], Tuple[int, bytes]],
) -> List[NewsItem]:
    # Google News RSS feed
    q = urllib.parse.quote_plus(query)
    url = f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
    try:
        status, body = http_get(url)
        if status != 200:
            return []
        xml_text = body.decode("utf-8", errors="ignore")
        return _parse_google_news_rss(xml_text, limit)
    except Exception:
        return []


def _parse_google_news_rss(xml_text: str, limit: int) -> List[NewsItem]:
    items: List[NewsItem] = []
    try:
        root = ET.fromstring(xml_text)
        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or _now_iso()).strip()
            source_el = item.find("source")
            source = source_el.text.strip() if source_el is not None and source_el.text else None
            summary = (item.findtext("description") or "").strip() or None
            items.append({"title": title, "url": link, "source": source, "published_at": pub, "summary": summary})
            if len(items) >= limit:
                break
    except ET.ParseError:
        return []
    return items
