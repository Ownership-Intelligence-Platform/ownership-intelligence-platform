from app.services.crawl.spiders.cn_company_dir_spider import CNCompanyDirSpider
from app.services.crawl.pipeline import write_jsonl

import os
import json
from pathlib import Path
import tempfile


def read_fixture(name: str) -> str:
    p = Path(__file__).parent / "fixtures" / name
    return p.read_text(encoding="utf-8")


def test_cn_company_dir_parse_and_write_jsonl():
    html = read_fixture("cn_company_dir_sample.html")
    spider = CNCompanyDirSpider()
    companies, ownerships = spider.parse_html(entity_id="CN_TEST_1", html=html, source_url="file://sample")
    assert len(companies) == 1
    assert companies[0]["name"].startswith("示例")
    assert len(ownerships) == 2
    assert any(o["owner_id"] == "张三" and o["owned_id"] == "CN_TEST_1" for o in ownerships)

    with tempfile.TemporaryDirectory() as tmpdir:
        comp_path = write_jsonl(companies, out_dir=tmpdir, filename_prefix="companies-CN_TEST_1")
        own_path = write_jsonl(ownerships, out_dir=tmpdir, filename_prefix="ownerships-CN_TEST_1")
        assert os.path.isfile(comp_path)
        assert os.path.isfile(own_path)
        with open(own_path, "r", encoding="utf-8") as f:
            lines = [json.loads(l) for l in f if l.strip()]
        assert len(lines) == 2
        assert all("meta_source_site" in l for l in lines)
