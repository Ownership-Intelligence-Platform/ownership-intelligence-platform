from app.services.name_screening_service import basic_name_scan, screen_name_against_watchlist


def test_basic_name_scan_empty():
    res = basic_name_scan("")
    assert res["entity_fuzzy_matches"] == []
    assert res["watchlist_hits"] == []


def test_screen_against_watchlist_demo_hit():
    # "张三" is present in the demo watchlist with a positive score
    hits = screen_name_against_watchlist("张三")
    assert any(h["name"] == "张三" and h["score"] >= 2 for h in hits)
