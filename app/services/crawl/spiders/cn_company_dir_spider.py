from __future__ import annotations

import time
from typing import Dict, List, Optional, Tuple

import httpx
from selectolax.parser import HTMLParser

from ..base import CompanyRecord, OwnershipRecord, SourceMeta, Spider


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class CNCompanyDirSpider(Spider):
    """Configurable HTML spider for CN enterprise directory-like pages.

    This spider is selector-driven to adapt to different provincial/portal layouts.
    For MVP, it supports parsing a company name and a shareholder table.

    Selectors (CSS):
      - company_name_sel: selector to a node that contains the company name text
      - shareholders_row_sel: selector matching rows of a shareholder table
      - shareholder_name_sel: relative selector for shareholder name within row
      - shareholder_stake_sel: relative selector for stake within row (e.g., '10.5%' or '0.105')

    Note: For real-world CN registry sites with captcha/JS, fetching may need to
    be done separately and fed via local HTML (--file). This class focuses on parsing.
    """

    name = "cn_company_dir"

    def __init__(
        self,
        *,
        timeout: float = 12.0,
        headers: Optional[Dict[str, str]] = None,
        company_name_sel: str = "h1.company-name, .company-name, .ent-name, .title .name",
        shareholders_row_sel: str = "table.shareholders tbody tr",
        shareholder_name_sel: str = "td:nth-child(1), .shareholder-name",
        shareholder_stake_sel: str = "td:nth-child(2), .shareholder-stake",
    ) -> None:
        self.timeout = float(timeout)
        self.headers = headers or {"User-Agent": "OIP-Crawler/0.1"}
        self.company_name_sel = company_name_sel
        self.shareholders_row_sel = shareholders_row_sel
        self.shareholder_name_sel = shareholder_name_sel
        self.shareholder_stake_sel = shareholder_stake_sel

    # --- Public API ---
    def fetch_from_url(self, entity_id: str, url: str) -> Tuple[List[Dict], List[Dict]]:
        html = self._get(url)
        return self.parse_html(entity_id=entity_id, html=html, source_url=url)

    def parse_html(self, *, entity_id: str, html: str, source_url: str) -> Tuple[List[Dict], List[Dict]]:
        doc = HTMLParser(html)
        fetched = _now_iso()

        # Company name
        name_node = doc.css_first(self.company_name_sel)
        company_name = name_node.text(strip=True) if name_node else None
        comp_meta = SourceMeta(
            source_site="cn_company_dir",
            source_url=source_url,
            fetched_at=fetched,
            parser=self.name,
        )
        companies = [CompanyRecord(id=entity_id, name=company_name, type="Company", meta=comp_meta).to_dict()]

        # Shareholders
        ownerships: List[Dict] = []
        for row in doc.css(self.shareholders_row_sel) or []:
            sh_name = None
            stake_val: Optional[float] = None
            name_cell = row.css_first(self.shareholder_name_sel)
            if name_cell:
                sh_name = name_cell.text(strip=True)
            stake_cell = row.css_first(self.shareholder_stake_sel)
            if stake_cell:
                stake_text = (stake_cell.text(strip=True) or "").replace("％", "%")
                stake_val = self._parse_stake(stake_text)
            if not sh_name:
                continue
            meta = SourceMeta(
                source_site="cn_company_dir",
                source_url=source_url,
                fetched_at=fetched,
                parser=self.name,
            )
            # For MVP we use shareholder name as id when we don't have a registry id
            owner_id = sh_name
            rec = OwnershipRecord(owner_id=owner_id, owned_id=entity_id, stake=stake_val, meta=meta).to_dict()
            ownerships.append(rec)

        return companies, ownerships

    # --- Internals ---
    def _get(self, url: str) -> str:
        try:
            with httpx.Client(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
                r = client.get(url)
                r.raise_for_status()
                return r.text
        except Exception as _exc:
            return ""

    @staticmethod
    def _parse_stake(text: str) -> Optional[float]:
        t = (text or "").strip()
        if not t:
            return None
        # Examples: '10.5%', '10%', '0.105', '10.5 %'
        try:
            if t.endswith("%"):
                # normalize to percentage numeric (without symbol)
                num = float(t.rstrip("% "))
                return num
            # Try raw number; if <= 1, treat as ratio; else treat as percentage already
            num = float(t)
            return num * 100.0 if 0 <= num <= 1 else num
        except Exception:
            return None
