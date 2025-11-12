from __future__ import annotations

import argparse
import os
from typing import Optional

from .pipeline import write_jsonl
from .spiders.rss_spider import RSSNewsSpider
from .spiders.cn_company_dir_spider import CNCompanyDirSpider
from .spiders.sse_top10_spider import SseTop10Spider


def run_rss_news(entity_id: str, query: str, *, limit: int, out_dir: str) -> str:
    spider = RSSNewsSpider()
    records = spider.fetch(entity_id=entity_id, query=query, limit=limit)
    path = write_jsonl(records, out_dir=out_dir, filename_prefix=f"news-{entity_id}")
    return path


def main(argv: Optional[list] = None) -> int:
    parser = argparse.ArgumentParser(description="Run simple crawler tasks")
    sub = parser.add_subparsers(dest="cmd", required=True)

    rss = sub.add_parser("rss", help="Fetch company news via Google News RSS")
    rss.add_argument("entity_id", help="Entity id to attach news to (e.g., C1)")
    rss.add_argument("query", help="Search query (company name)")
    rss.add_argument("--limit", type=int, default=10, help="Max items to fetch")
    default_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    default_out = os.path.join(default_root, "data", "scraped", "news")
    rss.add_argument("--out-dir", default=default_out, help="Output directory for JSONL files")

    args = parser.parse_args(argv)
    os.makedirs(args.out_dir, exist_ok=True)

    if args.cmd == "rss":
        path = run_rss_news(args.entity_id, args.query, limit=args.limit, out_dir=args.out_dir)
        print(path)
        return 0

    # CN Company Directory HTML parsing demo
    cn = sub.add_parser("cnhtml", help="Parse a CN enterprise directory-like HTML to companies/ownerships JSONL")
    cn.add_argument("entity_id", help="Canonical id for the company (e.g., unified code or internal id)")
    src = cn.add_mutually_exclusive_group(required=True)
    src.add_argument("--url", help="Detail page URL to fetch")
    src.add_argument("--file", help="Local HTML file path")
    cn.add_argument("--companies-out", default=os.path.join(default_root, "data", "scraped", "companies"))
    cn.add_argument("--ownerships-out", default=os.path.join(default_root, "data", "scraped", "ownerships"))
    cn.add_argument("--company-sel", default="h1.company-name, .company-name, .ent-name, .title .name")
    cn.add_argument("--row-sel", default="table.shareholders tbody tr")
    cn.add_argument("--sh-name-sel", default="td:nth-child(1), .shareholder-name")
    cn.add_argument("--sh-stake-sel", default="td:nth-child(2), .shareholder-stake")

    if args.cmd == "cnhtml":
        spider = CNCompanyDirSpider(
            company_name_sel=args.company_sel,
            shareholders_row_sel=args.row_sel,
            shareholder_name_sel=args.sh_name_sel,
            shareholder_stake_sel=args.sh_stake_sel,
        )
        if args.url:
            companies, ownerships = spider.fetch_from_url(args.entity_id, args.url)
        else:
            with open(args.file, "r", encoding="utf-8") as f:
                html = f.read()
            companies, ownerships = spider.parse_html(entity_id=args.entity_id, html=html, source_url=args.file)
        os.makedirs(args.companies_out, exist_ok=True)
        os.makedirs(args.ownerships_out, exist_ok=True)
        comp_path = write_jsonl(companies, out_dir=args.companies_out, filename_prefix=f"companies-{args.entity_id}")
        own_path = write_jsonl(ownerships, out_dir=args.ownerships_out, filename_prefix=f"ownerships-{args.entity_id}")
        print(comp_path)
        print(own_path)
        return 0

    # SSE Top-10 shareholders (from API URL or local JSON)
    sse = sub.add_parser("sse_top10", help="Parse SSE top-10 shareholders from an API or local JSON file")
    sse.add_argument("entity_id", help="Canonical id of the company (e.g., C1 or unified code)")
    src2 = sse.add_mutually_exclusive_group(required=True)
    src2.add_argument("--api-url", help="Resolved JSON endpoint returning top-10 list")
    src2.add_argument("--file", help="Local JSON file path")
    sse.add_argument("--out-dir", default=os.path.join(default_root, "data", "scraped", "ownerships"))

    if args.cmd == "sse_top10":
        spider = SseTop10Spider()
        if args.api_url:
            ownerships = spider.fetch_from_api(args.entity_id, stock_code="", api_url=args.api_url)
        else:
            import json as _json
            with open(args.file, "r", encoding="utf-8") as f:
                payload = _json.load(f)
            ownerships = spider.parse_json(entity_id=args.entity_id, payload=payload, source_url=args.file)
        os.makedirs(args.out_dir, exist_ok=True)
        out_path = write_jsonl(ownerships, out_dir=args.out_dir, filename_prefix=f"ownerships-{args.entity_id}")
        print(out_path)
        return 0

    parser.error("unknown command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
