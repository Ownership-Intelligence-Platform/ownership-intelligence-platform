from app.services.crawl.spiders.sse_top10_spider import SseTop10Spider
from app.services.crawl.pipeline import write_jsonl

import os
import json
from pathlib import Path
import tempfile


def read_fixture(name: str) -> str:
    p = Path(__file__).parent / "fixtures" / name
    return p.read_text(encoding="utf-8")


def test_sse_top10_parse_and_write_jsonl():
    payload = json.loads(read_fixture("sse_top10_sample.json"))
    spider = SseTop10Spider()
    ownerships = spider.parse_json(entity_id="C1", payload=payload, source_url="file://sse.json")
    assert len(ownerships) == 10
    # ratio normalization: 0.145 -> 14.5%
    hkcc = next(o for o in ownerships if o["owner_id"] == "香港中央结算有限公司")
    assert abs(hkcc["stake"] - 14.5) < 1e-6

    with tempfile.TemporaryDirectory() as tmpdir:
        out = write_jsonl(ownerships, out_dir=tmpdir, filename_prefix="ownerships-C1")
        assert os.path.isfile(out)
        with open(out, "r", encoding="utf-8") as f:
            lines = [json.loads(l) for l in f if l.strip()]
        assert len(lines) == 10
        assert all("meta_source_site" in l for l in lines)
