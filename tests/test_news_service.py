from app.services.news_service import _parse_google_news_rss, get_company_news


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


def test_parse_google_news_rss_extracts_items():
    items = _parse_google_news_rss(SAMPLE_RSS, limit=10)
    assert len(items) == 2
    assert items[0]["title"].startswith("ExampleCorp")
    assert items[0]["url"] == "https://example.com/article1"
    assert items[0]["source"] == "Example News"


def test_get_company_news_uses_injected_http_get():
    # Inject a fake http_get that returns the sample RSS (fallback path)
    def fake_http_get(url: str):
        return 200, SAMPLE_RSS.encode("utf-8")

    items = get_company_news("ExampleCorp", limit=1, http_get=fake_http_get)
    assert len(items) == 1
    assert items[0]["url"] == "https://example.com/article1"
