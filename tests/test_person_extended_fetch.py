from app.services.graph_service import create_or_update_person_extended, get_person_extended


def test_person_extended_roundtrip():
    pid = "P_EXT_ROUND"
    basic = {"gender": "男", "nationality": "中国"}
    kyc = {"kyc_status": "approved", "kyc_risk_level": "medium"}
    create_or_update_person_extended(
        person_id=pid,
        name="测试用户",
        type_="Person",
        basic_info=basic,
        kyc_info=kyc,
    )
    ext = get_person_extended(pid)
    assert ext.get("id") == pid
    assert isinstance(ext.get("basic_info"), dict), ext
    assert ext.get("basic_info", {}).get("gender") == "男"
    assert ext.get("kyc_info", {}).get("kyc_status") == "approved"
