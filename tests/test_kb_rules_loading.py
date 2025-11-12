import json
from app.services.risk_service import load_kb

def test_kb_files_loadable():
    kb = load_kb(force=True)
    assert isinstance(kb, dict)
    assert "rules" in kb
    assert "lists" in kb
    assert "taxonomy" in kb
    # basic schema checks
    rules = kb["rules"]
    assert "weighted" in rules
    assert isinstance(rules["weighted"], list)
