from app.models.ownership import EntityCreate, OwnershipCreate


def test_entity_model():
    e = EntityCreate(id="E1", name="Alpha", type="Company")
    assert e.id == "E1"
    assert e.name == "Alpha"


def test_ownership_model():
    o = OwnershipCreate(owner_id="E1", owned_id="E2", stake=51.0)
    assert o.owner_id == "E1"
    assert o.stake == 51.0
