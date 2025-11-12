"""Lightweight web search + crawl service.

- Search provider: DuckDuckGo HTML (no API key) by default.
- HTTP client: httpx (with short timeouts)
- Extraction: BeautifulSoup + readability-lxml (if installed), with fallbacks

Returned document schema:
{
    "title": str | None,
    "url": str,
    "snippet": str | None,  # brief description if available from search
    "content": str | None,  # extracted page text clipped to max chars
}

Notes:
- This is intended for small k (e.g., 2-5) and brief timeouts. It is not a full crawler.
- Network failures are swallowed per-URL; best-effort results are returned.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Dict, Optional

import httpx
from bs4 import BeautifulSoup

try:
    from readability import Document as _ReadabilityDocument  # type: ignore
except Exception:  # pragma: no cover - optional dependency at runtime
    _ReadabilityDocument = None  # type: ignore


_DDG_SEARCH_URL = "https://duckduckgo.com/html/"


@dataclass
class WebSearch:
    timeout: float = 6.0
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
    max_content_chars: int = 3000

    def _client(self) -> httpx.Client:
        return httpx.Client(
            timeout=self.timeout,
            headers={
                "User-Agent": self.user_agent,
                "Accept-Language": "en,zh;q=0.9",
            },
            follow_redirects=True,
        )

    def search(self, query: str, k: int = 3) -> List[Dict[str, Optional[str]]]:
        """Search DuckDuckGo HTML results and return top k entries."""
        params = {"q": query}
        out: List[Dict[str, Optional[str]]] = []
        with self._client() as client:
            try:
                r = client.get(_DDG_SEARCH_URL, params=params)
                r.raise_for_status()
            except Exception:
                return out
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.select("a.result__a"):
                url = a.get("href")
                if not url:
                    continue
                title = a.get_text(strip=True) or None
                # snippet if present (result__snippet)
                snippet_el = a.find_parent("div", class_="result__body")
                snippet = None
                if snippet_el:
                    sn = snippet_el.select_one("a.result__snippet") or snippet_el.select_one("div.result__snippet")
                    if sn:
                        snippet = sn.get_text(" ", strip=True)
                out.append({"title": title, "url": url, "snippet": snippet})
                if len(out) >= k:
                    break
        return out

    def _extract_text(self, html: str) -> str:
        # Prefer readability if available for cleaner extraction
        if _ReadabilityDocument is not None:
            try:
                doc = _ReadabilityDocument(html)
                content_html = doc.summary(html_partial=True)
                title = doc.short_title() or ""
                soup = BeautifulSoup(content_html, "html.parser")
                text = title.strip() + "\n\n" + soup.get_text(" ", strip=True)
                text = re.sub(r"\s+", " ", text).strip()
                return text
            except Exception:
                pass
        # Fallback: simple text extraction
        soup = BeautifulSoup(html, "html.parser")
        # remove script/style
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = soup.get_text(" ", strip=True)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def fetch_content(self, url: str) -> Optional[str]:
        try:
            with self._client() as client:
                r = client.get(url)
                r.raise_for_status()
                txt = self._extract_text(r.text)
                if not txt:
                    return None
                if len(txt) > self.max_content_chars:
                    return txt[: self.max_content_chars]
                return txt
        except Exception:
            return None

    def search_and_crawl(self, query: str, k: int = 3) -> List[Dict[str, Optional[str]]]:
        results = self.search(query, k=k)
        out: List[Dict[str, Optional[str]]] = []
        for r in results:
            url = r.get("url")
            if not url:
                continue
            content = self.fetch_content(url)
            out.append({
                "title": r.get("title"),
                "url": url,
                "snippet": r.get("snippet"),
                "content": content,
            })
        return out
