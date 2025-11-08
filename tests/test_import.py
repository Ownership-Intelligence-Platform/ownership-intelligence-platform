import os
import tempfile

from app.services.import_service import import_graph_from_csv


def test_import_graph_from_csv_injects_and_counts():
    # Prepare temp CSV files
    with tempfile.TemporaryDirectory() as tmp:
        pr = tmp
        entities_csv_path = os.path.join(pr, "entities.csv")
        ownerships_csv_path = os.path.join(pr, "ownerships.csv")
        with open(entities_csv_path, "w", encoding="utf-8") as f:
            f.write("id,name,type\nE1,Alpha,Company\nE2,Beta,Company\n")
        with open(ownerships_csv_path, "w", encoding="utf-8") as f:
            f.write("owner_id,owned_id,stake\nE1,E2,60\n")

        # Collect calls via injected fakes
        created_entities = []
        created_edges = []

        def fake_create_entity(eid, name, type_):
            created_entities.append((eid, name, type_))
            return {"id": eid, "name": name, "type": type_}

        def fake_create_ownership(owner, owned, stake):
            created_edges.append((owner, owned, stake))
            return {"owner": owner, "owned": owned, "stake": stake}

        summary = import_graph_from_csv(
            entities_csv="entities.csv",
            ownerships_csv="ownerships.csv",
            project_root=pr,
            create_entity_fn=fake_create_entity,
            create_ownership_fn=fake_create_ownership,
        )

        # Validate counts
        assert summary["entities"]["unique_imported"] == 2
        assert summary["ownerships"]["unique_imported"] == 1
        # Validate calls captured
        assert ("E1", "Alpha", "Company") in created_entities
        assert ("E2", "Beta", "Company") in created_entities
        assert ("E1", "E2", 60.0) in created_edges
