from app.services.import_service import import_person_account_opening_from_csv


def test_import_person_account_opening(monkeypatch, tmp_path):
    # Prepare CSV
    p = tmp_path / "person_account_opening.csv"
    p.write_text(
        "person_id,name,id_no,phone,email,address,employer,bank_name,account_type,currencies,account_number\n"
        "P1,张伟,110101199001011234,13800138000,zhangwei@example.com,北京市朝阳区建国路 100 号,ABC 科技有限公司 / 软件工程师,HSBC,卓越理财账户,\"CNY,USD\",6217861234567890\n",
        encoding="utf-8",
    )

    # Capture set calls
    called = {}

    def fake_set_opening(person_id, payload):
        called[person_id] = payload
        return payload

    def fake_ensure_person(pid, name, typ):
        return {"id": pid}

    out = import_person_account_opening_from_csv(
        str(p), project_root=str(tmp_path), set_opening_fn=fake_set_opening, ensure_person_fn=fake_ensure_person
    )
    assert out["person_account_opening"]["updated"] == 1
    assert "P1" in called
    assert called["P1"]["bank_name"] == "HSBC"
    assert called["P1"]["account_type"] == "卓越理财账户"
    assert called["P1"]["currencies"] == "CNY,USD"
