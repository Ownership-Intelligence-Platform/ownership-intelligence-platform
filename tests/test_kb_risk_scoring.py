from app.services.risk_service import evaluate_kb_risk, load_kb


def test_deterministic_sanctions_hit():
    load_kb(force=True)
    payload = {
        "transfers": [
            {"from": "A1", "to": "B1", "amount_cny": 10000, "date": "2025-01-01", "to_region": "HK"}
        ],
        "beneficiary_name": "ACME OFFSHORE LTD",
    }
    res = evaluate_kb_risk(payload)
    assert res["score"] >= 100
    assert "sanctions_hit" in res["deterministic_triggers"]


def test_weighted_small_sum_aggregation():
    load_kb(force=True)
    # 3+ accounts over 5 days to same beneficiary with small amounts
    transfers = []
    for i, amt, day in [(1, 20000, 1), (2, 18000, 2), (3, 22000, 3), (4, 19000, 4), (5, 21000, 5)]:
        transfers.append({
            "from": f"A{i}",
            "to": "B1",
            "amount_cny": amt,
            "date": f"2025-01-0{day}",
            "to_region": "CN"
        })
    res = evaluate_kb_risk({"transfers": transfers, "beneficiary_name": "BETA"})
    assert any(d.get("id") == "small_sum_aggregation" and d.get("passed") for d in res["weighted_details"])  # rule passed
    assert any(lbl == "aml.ssa" for lbl in res["labels"])  # category attached
