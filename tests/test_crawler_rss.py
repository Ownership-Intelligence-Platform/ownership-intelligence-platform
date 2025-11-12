from app.services.crawl.spiders.rss_spider import RSSNewsSpider
from app.services.crawl.pipeline import write_jsonl

import os
import json
import tempfile


SAMPLE_RSS = """
<rss version="2.0">
  <channel>
    <title>News for ExampleCorp</title>
    <item>
      <title>ExampleCorp announces Q3 results</title>
      <link>https://example.com/article1</link>
      <pubDate>Fri, 01 Nov 2024 12:00:00 GMT</pubDate>
      <source url="https://example.com">Example News</source>
      <description>Strong revenue growth reported.</description>
    </item>
    <item>
      <title>Analysts upgrade ExampleCorp</title>
      <link>https://example.com/article2</link>
      <pubDate>Sat, 02 Nov 2024 08:00:00 GMT</pubDate>
      <source url="https://example.com">Market Daily</source>
      <description>Upgraded to Buy.</description>
    </item>
  </channel>
  </rss>
""".strip()


def test_rss_spider_parse_and_write_jsonl():
    spider = RSSNewsSpider()
    records = spider.parse_xml(SAMPLE_RSS, entity_id="C1", source_url="http://test", limit=10)
    assert len(records) == 2
    # Convert to dict form like pipeline expects
    dicts = [r.to_dict() for r in records]

    with tempfile.TemporaryDirectory() as tmpdir:
        out = write_jsonl(dicts, out_dir=tmpdir, filename_prefix="news-C1")
        assert os.path.isfile(out)
        # File should contain 2 lines
        with open(out, "r", encoding="utf-8") as f:
            lines = [json.loads(l) for l in f if l.strip()]
        assert len(lines) == 2
        # Has flattened meta
        assert all("meta_source_site" in l for l in lines)
