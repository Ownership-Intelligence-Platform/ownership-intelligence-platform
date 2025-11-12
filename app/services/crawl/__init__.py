"""Lightweight crawling subsystem (MVP).

Structure:
- base.py: common types and utilities
- pipeline.py: dedupe + JSONL staging writer
- spiders/: individual source implementations
- importer_adapter.py: read staging and import into graph
- runner.py: tiny CLI entrypoint for manual runs

This MVP uses httpx + lightweight parsing (xml/selectolax) and can later evolve
to dedicated frameworks per-source as needed.
"""

__all__ = [
    "types",
]
