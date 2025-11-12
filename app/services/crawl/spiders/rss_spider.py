from __future__ import annotations

import time
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional

import httpx

from ..base import NewsRecord, SourceMeta, Spider


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class RSSNewsSpider(Spider):
    name = "rss_news"

    def __init__(self, *, timeout: float = 10.0, headers: Optional[Dict[str, str]] = None) -> None:
        self.timeout = float(timeout)
        self.headers = headers or {"User-Agent": "OIP-Crawler/0.1"}

    def fetch(self, entity_id: str, query: str, *, limit: int = 10) -> List[Dict]:
        """Fetch news items for the given company/entity query via Google News RSS.

        Returns a list of normalized records with flattened meta fields.
        """
        if not query:
            return []
        limit = max(1, min(int(limit or 10), 50))
        url = self._google_news_rss_url(query)
        items = self._fetch_and_parse(entity_id, url, limit)
        return self.normalize_records(items)

    def _google_news_rss_url(self, query: str) -> str:
        q = urllib.parse.quote_plus(query)
        return f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"

    def _fetch_and_parse(self, entity_id: str, url: str, limit: int) -> List[NewsRecord]:
        try:
            with httpx.Client(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
                resp = client.get(url)
                if resp.status_code != 200:
                    return []
                xml_text = resp.text
        except Exception:
            return []

        return self.parse_xml(xml_text, entity_id=entity_id, source_url=url, limit=limit)

    @staticmethod
    def parse_xml(xml_text: str, *, entity_id: str, source_url: str, limit: int) -> List[NewsRecord]:
        records: List[NewsRecord] = []
        try:
            root = ET.fromstring(xml_text)
            for item in root.findall(".//item"):
                title = (item.findtext("title") or "").strip() or None
                link = (item.findtext("link") or "").strip() or None
                pub = (item.findtext("pubDate") or _now_iso()).strip() or None
                source_el = item.find("source")
                source = source_el.text.strip() if source_el is not None and source_el.text else None
                summary = (item.findtext("description") or "").strip() or None
                meta = SourceMeta(
                    source_site="google_news_rss",
                    source_url=source_url,
                    fetched_at=_now_iso(),
                    parser=RSSNewsSpider.name,
                )
                records.append(
                    NewsRecord(
                        entity_id=entity_id,
                        title=title,
                        url=link,
                        source=source,
                        published_at=pub,
                        summary=summary,
                        meta=meta,
                    )
                )
                if len(records) >= limit:
                    break
        except ET.ParseError:
            return []
        return records
