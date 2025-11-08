import os
import tempfile

from app.services.import_service import import_news_from_csv


def test_import_news_from_csv_creates_news_links():
    with tempfile.TemporaryDirectory() as tmp:
        pr = tmp
        news_csv_path = os.path.join(pr, "news.csv")
        with open(news_csv_path, "w", encoding="utf-8") as f:
            f.write("entity_id,title,url,source,published_at,summary\n")
            f.write("E1,Example earnings,https://example.com/a,ExampleSource,2024-11-01T12:00:00Z,Positive growth.\n")
            f.write("E1,Example earnings,https://example.com/a,ExampleSource,2024-11-01T12:00:00Z,Duplicate row ignored.\n")
            f.write("E2,New product launch,https://example.com/b,PRWire,2024-11-02T09:00:00Z,Launch details.\n")

        created_entities = []
        created_news = []

        def fake_create_entity(eid, name, type_):
            created_entities.append(eid)
            return {"id": eid}

        def fake_create_news(eid, title, url, source, published_at, summary):
            created_news.append((eid, title, url))
            return {"title": title, "url": url}

        summary = import_news_from_csv(
            news_csv="news.csv",
            project_root=pr,
            create_news_fn=fake_create_news,
            ensure_entity_fn=fake_create_entity,
        )

        assert summary["news"]["unique_imported"] == 2  # duplicate ignored
        assert ("E1", "Example earnings", "https://example.com/a") in created_news
        assert ("E2", "New product launch", "https://example.com/b") in created_news
        assert "E1" in created_entities and "E2" in created_entities