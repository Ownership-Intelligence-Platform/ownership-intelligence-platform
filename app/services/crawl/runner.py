from __future__ import annotations

import argparse
import os
from typing import Optional

from .pipeline import write_jsonl
from .spiders.rss_spider import RSSNewsSpider


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

    parser.error("unknown command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
