import os
import tempfile

from app.services.import_service import import_legal_reps_from_csv


def test_import_legal_reps_from_csv_injects_and_counts():
    with tempfile.TemporaryDirectory() as tmp:
        pr = tmp
        reps_csv_path = os.path.join(pr, "reps.csv")
        with open(reps_csv_path, "w", encoding="utf-8") as f:
            f.write("company_id,person_id,role\nC1,P1,Corporate Legal Representative\n")

        created_entities = []
        created_reps = []

        def fake_create_entity(eid, name, type_):
            created_entities.append((eid, name, type_))
            return {"id": eid}

        def fake_create_legal_rep(company_id, person_id, role):
            created_reps.append((company_id, person_id, role))
            return {"company_id": company_id, "person_id": person_id, "role": role}

        summary = import_legal_reps_from_csv(
            legal_reps_csv="reps.csv",
            project_root=pr,
            create_entity_fn=fake_create_entity,
            create_legal_rep_fn=fake_create_legal_rep,
        )

        assert summary["legal_representatives"]["unique_imported"] == 1
        assert ("C1", None, None) not in created_entities  # sanity
        assert ("C1", "P1", "Corporate Legal Representative") in created_reps
