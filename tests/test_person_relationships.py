import os
import types
import pytest

from app.api.routers.persons import api_create_relationship
from app.models.relationships import RelationshipCreate


class Calls:
    def __init__(self):
        self.items = []
    def add(self, *a, **kw):
        self.items.append((a, kw))


def test_create_relationship_auto_add_opening_from_csv(monkeypatch):
    # Ensure CSV path points to the provided demo CSV
    csv_path = os.path.join("data", "person_account_opening.csv")
    monkeypatch.setenv("PERSON_ACCOUNT_OPENING_CSV_PATH", csv_path)

    # Stub relationship creation to avoid touching DB
    def fake_create_person_relationship(**kwargs):
        return {"from": kwargs["subject_id"], "to": kwargs["related_id"], "type": kwargs["relation"].upper()}
    monkeypatch.setattr("app.api.routers.persons.create_person_relationship", fake_create_person_relationship)

    # Capture set_person_account_opening calls
    called = Calls()
    def fake_set_opening(pid, payload):
        called.add(pid, payload)
        return payload
    monkeypatch.setattr("app.api.routers.persons.set_person_account_opening", fake_set_opening)

    # Call API: subject=P2 adds father related=P1 (exists in CSV)
    payload = RelationshipCreate(relation="father", related_id="P1")
    resp = api_create_relationship("P2", payload)

    assert resp["relationship"]["to"] == "P1"
    # Should have attempted to set opening for P1 from CSV
    assert called.items, "expected account opening to be set from CSV"
    # Check that some known field present
    (args, _kwargs) = called.items[0]
    assert args[0] == "P1"
    ao = args[1]
    assert ao.get("bank_name") == "HSBC"


def test_create_relationship_invalid_type(monkeypatch):
    # Stub creation to ensure we hit validation before DB
    with pytest.raises(Exception):
        api_create_relationship("P2", RelationshipCreate(relation="unknown", related_id="P3"))
