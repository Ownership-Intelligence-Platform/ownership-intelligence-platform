from app.services.graph.person_info import set_person_account_opening, get_person_account_opening


def test_set_and_get_person_account_opening(monkeypatch):
    # Fake run_cypher to simulate Neo4j JSON-string storage
    store = {}

    def fake_run_cypher(query, params):
        pid = params.get("id")
        if "RETURN p.account_opening_json AS account_opening_json" in query and "SET" not in query:
            return [{"account_opening_json": store.get(pid)}]
        if "SET p:Person, p.account_opening_json = $ao_json" in query:
            store[pid] = params.get("ao_json")
            return [{"account_opening_json": store[pid]}]
        return []

    monkeypatch.setattr("app.services.graph.person_info.run_cypher", fake_run_cypher)

    pid = "P_TEST"
    payload = {
        "name": "张伟",
        "bank_name": "HSBC",
        "account_type": "卓越理财账户",
        "currencies": "CNY,USD",
        "account_number": "6217861234567890",
        "id_no": "110101199001011234",
        "phone": "13800138000",
        "email": "zhangwei@example.com",
        "address": "北京市朝阳区建国路 100 号",
        "employer": "ABC 科技有限公司 / 软件工程师",
    }

    stored = set_person_account_opening(pid, payload)
    # ensure only masked versions are stored
    assert stored.get("account_number_masked", "").endswith("7890")
    assert stored.get("id_no_masked", "").endswith("1234")
    assert "account_number" not in stored
    assert "id_no" not in stored

    out = get_person_account_opening(pid)
    assert out["bank_name"] == "HSBC"
    assert out["account_number_masked"].endswith("7890")
    assert out["id_no_masked"].endswith("1234")
