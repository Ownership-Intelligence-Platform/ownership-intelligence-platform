# Person Data Schema (Phase 1)

This document defines the extended person-centric fields for KYC, risk, network and provenance.

## Core Identification

| Field               | Description                          |
| ------------------- | ------------------------------------ |
| id                  | Unique person id (primary key)       |
| name                | Person name                          |
| gender              | Gender (男/女/other)                 |
| birth_date          | ISO date YYYY-MM-DD                  |
| nationality         | Country of nationality               |
| residential_address | Current residential address          |
| registered_address  | Registered / hukou address           |
| language_pref       | Preferred language code (e.g. zh_CN) |
| id_number           | National ID or similar               |
| passport_number     | Passport identifier                  |

## KYC / Onboarding (kyc_info)

| Field                    | Notes                            |
| ------------------------ | -------------------------------- |
| kyc_risk_level           | low/medium/high                  |
| kyc_status               | pending/approved/failed          |
| onboarding_date          | Date of initial onboarding       |
| source_of_funds_declared | Declared primary source          |
| source_of_funds_verified | Verified source (if different)   |
| pep_status               | pep / relative / none            |
| sanction_screen_hits     | Count of sanctions list hits     |
| watchlist_hits           | Internal/external watchlist hits |

## Risk Profile (risk_profile)

| Field                    | Notes                                         |
| ------------------------ | --------------------------------------------- |
| composite_risk_score     | 0-100 aggregated score                        |
| risk_factors             | Array of factor tags (e.g. negative_news_low) |
| negative_news_count      | Count of tagged adverse media items           |
| adverse_media_last_check | Date of last media scan                       |
| high_risk_txn_ratio      | Float 0-1 ratio of flagged transactions       |

## Network Info (network_info)

| Field                      | Notes                             |
| -------------------------- | --------------------------------- |
| known_associates           | List of related person ids        |
| employers                  | List of company ids               |
| roles                      | List of role / titles             |
| relationship_density_score | Float clustering density metric   |
| cluster_id                 | Optional graph cluster identifier |

## Geo Profile (geo_profile)

| Field               | Notes                                        |
| ------------------- | -------------------------------------------- |
| primary_country     | Main operating country                       |
| countries_recent_6m | Array of countries accessed in last 6 months |
| offshore_exposure   | Boolean indicating offshore usage            |
| geo_anomaly_score   | Float anomaly indicator                      |

## Compliance Info (compliance_info)

| Field                   | Notes                                |
| ----------------------- | ------------------------------------ |
| last_manual_review_date | Date of last human compliance review |
| next_review_due         | Next scheduled review date           |
| review_notes            | Free-text notes                      |
| aml_case_open           | Boolean flag for active AML case     |
| aml_case_id             | Identifier of the AML case if open   |

## Provenance (provenance)

| Field                    | Notes                                         |
| ------------------------ | --------------------------------------------- |
| data_source_urls         | Array of source URLs used to build profile    |
| crawler_last_run         | Date/time of last crawler run                 |
| crawler_confidence_score | Float 0-1 confidence score from QA heuristics |

## Import Mapping

Flat CSV columns are mapped to grouped dicts in `import_persons_from_csv`:

- basic_info: gender,birth_date,nationality,residential_address,registered_address,language_pref
- id_info: id_number,passport_number
- job_info: employers,roles
- kyc_info: kyc_risk_level,kyc_status,onboarding_date,source_of_funds_declared,source_of_funds_verified,pep_status,sanction_screen_hits,watchlist_hits
- risk_profile: composite_risk_score,risk_factors,negative_news_count,adverse_media_last_check,high_risk_txn_ratio
- network_info: known_associates,relationship_density_score,cluster_id
- geo_profile: primary_country,countries_recent_6m,offshore_exposure,geo_anomaly_score
- compliance_info: last_manual_review_date,next_review_due,review_notes,aml_case_open,aml_case_id
- provenance: data_source_urls,crawler_last_run,crawler_confidence_score

List-like columns use comma separation; booleans and numeric parsing handled by importer.

## Future Phases (Preview)

Phase 2 will add: sensitive access gating, network algorithms (centrality, community), dedupe candidates.
Phase 3 will add: dynamic risk recomputation, behavioral anomaly models, asset source aggregation.
