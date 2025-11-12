# Black-Industry Knowledge Base (KB) — MVP Implementation Plan

This report translates the requirement in `docs/black_industry_knowledge_base.en.md` into a concrete, minimal yet end-to-end MVP that integrates with the existing Ownership Intelligence Platform codebase.

## 1) Objective and Success Criteria

Objective: Deliver a working slice that can ingest a small set of illicit-risk knowledge (taxonomy, features, rules), match it against the existing knowledge graph and sample transaction data, and expose a simple API to score entities/transactions for risk.

Success criteria (MVP):

- Can load a minimal set of rules (deterministic + weighted) without a new DB (file-based for now).
- Can evaluate a provided account/entity or simplified transaction chain and return a risk score and matched features.
- Can annotate graph nodes (Neo4j) with matched high-risk tags for a small demo dataset.
- Has a small set of tests that turn green.

Out of scope (MVP): full-featured admin UI, rule versioning, external data connectors, high-scale performance.

## 2) MVP Scope (narrow but useful)

Covered illicit patterns:

- Money laundering – multi-account, multi-day small-sum aggregation.
- Money laundering – cross-border small remittances to offshore recipients.

Supported data:

- Subject basics (entities/accounts) from existing CSVs in `data/`.
- Simple transaction chains (use `transactions.csv` as the seed; enrich if needed with a few synthetic examples).
- Minimal lists: high-risk regions, sanctions-like list (file-based mock).

User stories:

- As an analyst, I POST an account or a transaction set to `/risk/evaluate` and get back a score + matched rules + explanation.
- As an operator, I trigger `/risk/annotate-graph` to tag matched high-risk nodes in Neo4j for a demo subgraph.

## 3) Architecture (MVP)

Components (reusing current repo):

- KB Storage (file-based): YAML/JSON files in `app/kb/` for taxonomy, features, and rules.
- Rule Engine (in-code): lightweight evaluator in Python that supports deterministic checks and weighted scoring.
- Graph Integration: reuse `app/db/neo4j_connector.py` and `app/services/graph_service.py` to read/write node labels/props.
- Risk Service: extend `app/services/risk_service.py` to load rules, evaluate inputs, compute scores, and create explanations.
- API: add router endpoints under `app/api/routers/` (e.g., `risk_kb.py`) or extend `analysis.py` with MVP endpoints.

No new server/processes; reuse FastAPI app.

## 4) Data Model — Minimal Contracts

4.1 KB files (YAML or JSON; choose JSON for simplicity)

- `app/kb/taxonomy.json`
- `app/kb/rules.json`
- `app/kb/lists.json`

  4.2 Schemas (illustrative)

- Taxonomy

```json
{
  "money_laundering": {
    "id": "aml",
    "children": {
      "small_sum_aggregation": { "id": "aml.ssa" },
      "cross_border_smurfing": { "id": "aml.cbs" }
    }
  }
}
```

- Lists

```json
{
  "high_risk_regions": ["GG", "KY", "VG"],
  "sanctioned_parties": ["ACME OFFSHORE LTD", "JOHN DOE INTL"]
}
```

- Rules (mix of deterministic and weighted)

```json
{
  "version": 1,
  "deterministic": [
    {
      "id": "sanctions_hit",
      "description": "Counterparty is on sanctions-like list",
      "match": { "counterparty_name_in_sanctions": true },
      "risk_label": "high",
      "category": "aml",
      "effect": { "score": 100 }
    }
  ],
  "weighted": [
    {
      "id": "small_sum_aggregation",
      "category": "aml.ssa",
      "weights": {
        "small_amount": 0.25,
        "multi_accounts": 0.25,
        "consecutive_days": 0.2,
        "same_beneficiary": 0.2,
        "total_volume": 0.1
      },
      "threshold": 0.7,
      "hints": {
        "small_amount_cny_max": 50000,
        "min_days": 5,
        "min_accounts": 3
      }
    },
    {
      "id": "cross_border_offshore",
      "category": "aml.cbs",
      "weights": {
        "cross_border": 0.3,
        "small_amount": 0.2,
        "same_offshore_beneficiary": 0.3,
        "frequency": 0.2
      },
      "threshold": 0.7,
      "hints": {
        "offshore_region_list": "high_risk_regions",
        "small_amount_cny_max": 50000,
        "min_days": 3
      }
    }
  ]
}
```

4.3 Evaluation Input Contracts

- Account/Entity evaluation

```json
{
  "entity_name": "Foo Trading Co.",
  "account_id": "A123",
  "history_days": 10
}
```

- Transaction chain evaluation

```json
{
  "transfers": [
    {
      "from": "A1",
      "to": "B1",
      "amount_cny": 20000,
      "date": "2025-01-01",
      "to_region": "CN"
    },
    {
      "from": "A2",
      "to": "B1",
      "amount_cny": 18000,
      "date": "2025-01-02",
      "to_region": "CN"
    },
    {
      "from": "A3",
      "to": "B1",
      "amount_cny": 22000,
      "date": "2025-01-03",
      "to_region": "HK"
    }
  ],
  "beneficiary_name": "ACME OFFSHORE LTD"
}
```

4.4 Evaluation Output Contract

```json
{
  "score": 85,
  "labels": ["aml", "aml.ssa"],
  "deterministic_triggers": ["sanctions_hit"],
  "matched_features": [
    "small_amount",
    "multi_accounts",
    "consecutive_days",
    "same_beneficiary"
  ],
  "explanation": "Matched sanctions list; small-sum high-frequency aggregation over 5+ days to same beneficiary"
}
```

## 5) Rule Evaluation — Minimal Algorithm

- Deterministic phase: If any deterministic rule matches, cap score at max(rule.effect.score) and add the rule to triggers.
- Weighted phase: For each weighted rule:
  - Compute feature flags from input/graph context (e.g., small_amount, multi_accounts, consecutive_days, same_beneficiary, cross_border).
  - Score = sum(weight for each matched feature).
  - If score ≥ rule.threshold, attach rule.category to labels and add matched feature names.
- Final score: max(deterministic_score, max(weighted_scores_normalized\*100)).
- Provide an explanation sentence from matched rules/features.

## 6) Data Sources and Ingestion (MVP)

- Use existing CSVs in `data/` (`entities.csv`, `transactions.csv`, `ownerships.csv`) as baseline.
- Add two tiny mock files in `app/kb/`:
  - `lists.json` (as above).
  - `rules.json` (as above).
- If needed, generate a few synthetic transactions to ensure coverage (multiple accounts → same beneficiary over 5+ days; cross-border to offshore).
- No external connectors in MVP.

## 7) Graph Integration (Neo4j)

- For a small subset of nodes (e.g., entities present in synthetic chains), write back properties:
  - `risk.score`: number
  - `risk.labels`: array
  - `risk.matchedRules`: array
- Provide a service method `annotate_graph(selection)` that runs evaluation for the selected subgraph and writes properties.
- Reuse `neo4j_connector` and `graph_service` for queries and updates.

## 8) API Design (FastAPI)

Add endpoints (in a new router, e.g., `app/api/routers/risk_kb.py`) or extend `analysis.py`:

- `POST /risk/evaluate` — body: account or transaction chain (as above). Returns Evaluation Output.
- `POST /risk/annotate-graph` — body: optional selection filter (entity ids). Returns counts of updated nodes.
- `GET /kb/rules` — returns current rules.json (read-only in MVP).

Authentication: none in MVP (local use). Add later if exposing externally.

## 9) Testing (MVP)

Create tests in `tests/`:

- `test_kb_rules_loading.py` — rules load and schema sanity.
- `test_risk_scoring.py` —
  - happy path: small-sum aggregation returns labels and score ≥ threshold.
  - deterministic: sanctions hit returns score 100.
- `test_graph_annotation.py` — with a tiny in-memory or mocked Neo4j layer, verify properties set on nodes.

Reuse `pytest.ini`. Keep tests small and deterministic.

## 10) Implementation Map to Repo

- `app/kb/` (new):
  - `rules.json` — initial two weighted rules + one deterministic rule.
  - `lists.json` — high-risk regions + sample sanctions.
  - `taxonomy.json` — AML with two subcategories.
- `app/services/risk_service.py` (extend):
  - `load_kb()` to load JSON files.
  - `evaluate(input)` to compute score/labels.
  - `annotate_graph(selection)` to write results to Neo4j.
- `app/api/routers/risk_kb.py` (new):
  - FastAPI endpoints described above.

Optionally, add a simple documentation page linking to the endpoints.

## 11) Delivery Plan and Timeline

Estimated 5–7 working days for MVP:

- Day 1: Create `app/kb/` files; implement loader; add router scaffold.
- Day 2: Implement deterministic + weighted scoring; basic unit tests for loader/scorer.
- Day 3: Hook into Neo4j; implement `annotate_graph`; small test or mock.
- Day 4: Build `/risk/evaluate`, `/kb/rules`; wire request/response validation; add tests.
- Day 5: Add `/risk/annotate-graph`; demo data prep; end-to-end test; docs and polish.
- Buffer (Days 6–7): Fixes and optional UI snippet.

## 12) Risks and Mitigations

- Incomplete data coverage → Use synthetic minimal examples alongside CSVs.
- Ambiguity in entity normalization → Start with exact string matching; add normalization later.
- Neo4j write permissions/env variance → Gate writes behind a flag; support dry-run.

## 13) Acceptance Criteria (Demo Script)

- Run the API locally; call `/kb/rules` to view rules.
- POST a sample chain to `/risk/evaluate` → response contains score, labels (e.g., `aml.ssa`), explanation.
- Run `/risk/annotate-graph` on a small selection → verify nodes in Neo4j have `risk.*` properties.
- All new tests pass locally with `pytest`.

## 14) Next Steps Beyond MVP

- Admin UI for rule CRUD and versioning; persist to a DB.
- Entity resolution and fuzzy matching for names and regions.
- Real connectors for sanctions, PEP, and regulatory lists.
- More rule families (fraud verticals), performance tuning, streaming evaluation pipeline.
