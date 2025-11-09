from app.services.risk_service import analyze_entity_risks


def test_analyze_entity_risks_with_injected_fakes():
    # Prepare fake data retrieval functions (no Neo4j dependency)
    def fake_get_entity(eid):
        if eid == "E1":
            return {"id": "E1", "name": "Alpha Corp", "type": "Company"}
        return {}

    def fake_get_accounts(eid):
        return [
            {"account_number": "A-1", "bank_name": "BankZ", "balance": 2_000_000.0},  # High balance
            {"account_number": "A-2", "bank_name": None, "balance": 50_000.0},  # Missing bank name
        ]

    def fake_get_transactions(eid, direction="both"):
        return [
            {"from_id": "E1", "to_id": "E1", "amount": 10_000.0, "channel": "cash", "time": None},  # self-loop + cash + missing time
            {"from_id": "E1", "to_id": "E2", "amount": 800_000.0, "channel": "wire", "time": "2024-01-01"},  # large amount
        ]

    def fake_get_guarantees(eid, direction="both"):
        return [
            {"guarantor_id": "E1", "guaranteed_id": "E2", "amount": 2_500_000.0},  # large guarantee
            {"guarantor_id": "E1", "guaranteed_id": "E1", "amount": 100_000.0},  # self guarantee
        ]

    def fake_get_supply(eid, direction="both"):
        return [
            {"supplier_id": "E1", "customer_id": "E2", "frequency": 60},  # high frequency
            {"supplier_id": "E1", "customer_id": "E1", "frequency": 5},   # self supplier
        ]

    def fake_get_stored_news(eid):
        return [
            {"title": "Alpha Corp under investigation", "summary": "Regulatory probe ongoing"},
            {"title": "Alpha Corp quarterly results", "summary": "Positive earnings"},
        ]

    def fake_get_external_news(name, limit=10):
        return [
            {"title": f"{name} faces lawsuit", "summary": "Details emerge"},
        ]

    result = analyze_entity_risks(
        "E1",
        get_entity_fn=fake_get_entity,
        get_accounts_fn=fake_get_accounts,
        get_transactions_fn=fake_get_transactions,
        get_guarantees_fn=fake_get_guarantees,
        get_supply_chain_fn=fake_get_supply,
        get_stored_news_fn=fake_get_stored_news,
        get_external_news_fn=fake_get_external_news,
        news_limit=5,
    )

    assert result["entity"]["id"] == "E1"
    # Check counts
    assert result["accounts"]["risky_count"] == 2  # both accounts flagged
    assert result["transactions"]["risky_count"] == 2
    assert result["guarantees"]["risky_count"] == 2
    assert result["supply_chain"]["risky_count"] == 2
    assert result["news"]["risky_count"] >= 2  # investigation + lawsuit
    # Overall score should be > 0 and reflect multiple flags
    assert result["summary"]["overall_risk_score"] > 0
