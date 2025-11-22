import os
from app.services.import_service import import_persons_from_csv
from app.services.graph_service import get_person_extended, create_or_update_person_extended
from app.db.neo4j_connector import run_cypher

DATA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'persons.csv'))


def test_import_persons_extended_basic():
    # Ensure file exists
    assert os.path.isfile(DATA_PATH)
    summary = import_persons_from_csv(DATA_PATH, project_root=os.path.abspath(os.path.join(os.path.dirname(__file__), '..')), upsert_person_fn=create_or_update_person_extended)
    assert summary['persons']['processed_rows'] >= 2
    assert summary['persons']['upserted'] >= 2
    # Fetch one person and validate extended dict presence
    person_id = 'P2001'
    ext = get_person_extended(person_id)
    assert ext.get('id') == person_id
    assert ext.get('kyc_info') is not None
    assert ext.get('risk_profile') is not None
    # Numeric parsing checks
    kyc = ext['kyc_info']
    assert isinstance(kyc.get('sanction_screen_hits'), int)
    risk = ext['risk_profile']
    assert isinstance(risk.get('composite_risk_score'), float)


def test_import_persons_extended_numeric_and_boolean():
    person_id = 'P2002'
    ext = get_person_extended(person_id)
    assert ext.get('id') == person_id
    kyc = ext.get('kyc_info')
    assert kyc is not None
    assert kyc.get('kyc_risk_level') == 'high'
    risk = ext.get('risk_profile')
    assert risk.get('composite_risk_score') > 50
    geo = ext.get('geo_profile')
    assert geo.get('offshore_exposure') is True
    provenance = ext.get('provenance')
    assert isinstance(provenance.get('crawler_confidence_score'), float)
