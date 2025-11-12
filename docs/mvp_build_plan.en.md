# MVP Build Plan — Ownership Intelligence Platform

## Executive summary

Build a focused MVP that proves end-to-end value: import data → construct a knowledge graph → run basic risk analytics and name screening → expose APIs → render a simple interactive graph → auto-generate a concise due‑diligence report. Target 4–6 weeks with weekly demoable increments.

## MVP scope (in) and non‑goals (out)

In-scope MVP capabilities:

- Data ingestion: Load provided CSVs in `data/` into Neo4j (entities, ownerships, guarantees, supply chain, transactions, locations, employment, accounts, news).
- Graph model: Minimal, consistent node/edge schema to support entity lookup, shortest paths, ownership look‑through, basic centrality.
- Risk knowledge base: Load `app/kb/*.json` and apply 5–10 simple, explainable rules (e.g., adverse news flag, guarantee exposure, suspicious transaction patterns) with score aggregation.
- Name screening (V1): Chinese/English name normalization + pinyin and fuzzy matching; list match against configurable local lists (sanctions/PEP stubs) with tunable thresholds.
- Analytics: Shortest path between entities, ownership penetration to UBO within limited depth, degree/score ranking, simple community detection (optional if time allows).
- APIs: FastAPI endpoints to query entities, paths, risk scores, and screening results; basic pagination and error handling.
- UI: Minimal D3-based pages in `static/` to visualize a focus entity, neighbors, and risk highlights; search box with autocomplete.
- Report: Generate a short markdown/HTML “CDD snapshot” for a target entity (profile, key relations, top risks, name-screening hits).

Non-goals for MVP:

- Full-fledged cross-border AML models, production-grade list ingestion pipelines, large-scale tuning, multilingual NER, advanced sanctions evasion detection, or enterprise RBAC.

## Target users and outcomes

- Risk and due-diligence analysts validate that the platform can: (a) find entities, (b) view critical relations, (c) see risk explanations, (d) generate a report, (e) screen names with acceptable precision/recall for a pilot set.

## Architecture overview

- API: FastAPI app (`app/main.py`, `app/api/routers/*`).
- Graph DB: Neo4j, accessed via `app/db/neo4j_connector.py` and `app/services/graph_service.py`.
- Services: Import (`app/services/import_service.py`), risk (`app/services/risk_service.py`), news (`app/services/news_service.py`), graph algorithms (`app/services/graph/*`).
- Knowledge base: JSON rule assets in `app/kb/` loaded by `risk_service` and `risk_kb` router.
- Frontend: Static D3 pages in `static/` (reuse `index.html`, `person_network.html`, modules under `static/modules/`).
- Tests: `tests/*` cover imports, models, rules, news, network and penetration paths.

## Data model (MVP subset)

- Nodes: Entity, Person, Account, Location, NewsArticle.
- Relationships: OWNS(percentage), GUARANTEES(amount), SUPPLIES_TO, EMPLOYED_AT, TRANSACTED_WITH, LOCATED_IN, MENTIONS.
- Key properties: names (cn/en/pinyin), ids (registration numbers), risk flags, timestamps.

## Iteration plan (4–6 weeks)

Week 1 — Foundations

- Stand up dev environment with `docker-compose.yml` (app + Neo4j). Validate connection lifecycle in `neo4j_connector.py`.
- Import pipeline: load all CSVs deterministically with idempotency; unit tests green for `test_import.py`, `test_reps_import.py`.
- Define and document the MVP graph schema; backfill mapping from each CSV to nodes/edges.

Week 2 — Core graph + queries

- Implement entity search (by name, alias, pinyin) and detail endpoints.
- Shortest path endpoint (entity↔entity); ownership penetration (depth ≤ 4) to approximate UBO.
- Minimal ranking metrics (degree, simple centrality) to surface key nodes.

Week 3 — Risk KB + news

- Load `rules.json`/`lists.json` and implement 5–10 rules; compute per-entity risk scores with explanations.
- News import/parsing from `news.csv`; link to entities; rule: adverse news boosts risk subscore.
- Expose risk APIs and ensure `test_kb_rules_loading.py`, `test_kb_risk_scoring.py`, `test_news_import.py`, `test_news_service.py` pass.

Week 4 — Name screening V1 + UI

- Implement normalization: lowercase, punctuation stripping, cn/en synonyms, pinyin generation. Add fuzzy matching (token set ratio) with thresholds.
- List screening against local sanctions/PEP stubs; API for batch screening with traceable match details.
- Hook D3 views to show focus entity, neighbors, and risk heat (color coding); basic search box and click-to-drill.

Week 5 — Report + hardening

- Generate markdown/HTML “CDD snapshot” with entity profile, top relations, risk summary, screening hits, and mini graph PNG (optional via headless render or embedded SVG).
- Add pagination, timeouts, input validation, and basic rate limiting.
- Load/performance smoke tests; target P50 API latency < 300 ms on local sample data.

Week 6 — Pilot readiness (buffer)

- Bug fixes, doc polish, demo data refresh, operator runbook, and onboarding checklist.

## Feature slices and acceptance criteria

1. Import and schema

- Input: CSVs in `data/`.
- Output: Nodes/relationships created once; re-runs are idempotent; metrics logged (counts per type).
- Acceptance: `test_import.py`, `test_models.py`, `test_reps_import.py` pass; import time < 10 min on dev laptop.

2. Entity search + detail

- Input: name/alias query (cn/en/pinyin).
- Output: Top-10 candidates with scores; entity detail includes properties and first-degree neighbors.
- Acceptance: Query returns expected fixtures; 200 OK with <300 ms P50.

3. Paths and ownership penetration

- Input: two entity ids; target entity id for penetration.
- Output: Shortest path (≤ 3 hops default); chain of ownership up to depth 4 with cumulative percentages.
- Acceptance: `test_penetration_paths.py`, `test_person_network.py` pass.

4. Risk rules + scores

- Input: entity id.
- Output: Risk score (0–100) with rule-level contributions and evidence (e.g., news links, guarantees total, counterparties).
- Acceptance: `test_kb_rules_loading.py`, `test_risk_service.py`, `test_kb_risk_scoring.py` pass; explanations present.

5. Name screening V1

- Input: list of names.
- Output: Matches with type (exact/fuzzy/pinyin), score, and matched list entry.
- Acceptance: Manual set achieves ≥90% recall and ≥85% precision on pilot set; latency < 50 ms/name average on 1k names.

6. UI graph view

- Input: focus entity selection.
- Output: Interactive graph of 1–2 hop neighborhood with risk heat; click to open detail.
- Acceptance: Analysts navigate from search → graph → detail in ≤ 3 clicks.

7. CDD snapshot report

- Input: entity id.
- Output: Markdown/HTML report saved to `reports/` and downloadable via API.
- Acceptance: Contains profile, top relations, risk summary, screening hits; renders in browser without broken assets.

## APIs (illustrative, keep consistent with existing routers)

- GET /entities/search?q=...
- GET /entities/{id}
- GET /network/shortest-path?src=...&dst=...
- GET /ownership/penetration/{id}?depth=4
- GET /risk/{id}
- POST /screening/names
- GET /reports/cdd/{id}

Note: Reuse/add under `app/api/routers/*` to match current conventions and tests.

## Metrics and evaluation

- Functional: test pass-rate ≥95% on `tests/` suite.
- Screening: precision/recall as above on pilot set; track FP/FN with confusion matrix.
- Performance: P50 < 300 ms for key GET APIs on sample data; import < 10 min.
- UX: Analysts complete 5 scripted tasks in ≤ 10 minutes with ≥ 4/5 satisfaction.

## Data, environments, and ops

- Data: Seed from `data/*.csv`; create small curated sanctions/PEP sample lists.
- Environments: Local dev via `docker-compose`; one shared demo environment (optional).
- Observability: Structured logs with request ids; basic timing metrics per endpoint.
- Security/compliance: Configurable redaction for PII in logs; list data sourced legally; document update cadence.

## Risks and mitigations

- Name ambiguity: Start with conservative thresholds; expose review queue/export.
- Graph scale: Keep MVP data small; index critical labels/props; cap query depths.
- Data quality: Add validators and missing-field fallbacks; track import anomalies.
- Scope creep: Enforce non-goals; backlog advanced features post‑MVP.

## Documentation and handover

- Update README with run steps and main endpoints.
- Add `docs/schema.md` and `docs/risk_rules.md` describing schema and rules.
- Provide a short demo script and sample entities to showcase value.

## Post‑MVP roadmap (preview)

- List ingestion pipeline (OFAC, EU, UN, domestic), entity resolution improvements, advanced graph algorithms (HITS/PageRank), report templating engine, RBAC/auditing, and scaling/ha.
