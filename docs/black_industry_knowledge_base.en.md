# Illicit Industry ("Black Industry") Knowledge Base: Concepts and Practical Implementation Plan

> Note on terminology: In this document, "Black Industry" (黑产) refers to illicit economic activities such as telecom fraud, online gambling, illegal fundraising, money laundering, and cross-border smuggling.

## I. Core Concepts of the Black-Industry Knowledge Base

A Black-Industry Knowledge Base is a structured, reusable, and dynamically updated risk knowledge system that consolidates crime patterns, risk features, behavioral chains, and related entities across illicit industries (e.g., telecom fraud, online gambling, illegal fundraising, money laundering, cross-border smuggling).

It is not merely a "case library." Rather, it converts unstructured information (cases, bulletins) into structured features (labels and rules that algorithms can interpret), ultimately becoming the core basis for systems to automatically identify emerging illicit risks. In other words, it embeds a "risk-recognition brain" into your system so it can emulate an expert: matching features and quickly deciding whether a transaction or a customer is associated with illicit activity.

### Core Value

1. Address the challenge of recognizing new illicit patterns: Black-industry tactics evolve quickly (e.g., new laundering methods, scam scripts). A knowledge base that updates dynamically keeps the system in sync with risk changes.
2. Enable automated risk matching: Convert expert-curated features into algorithmic rules to replace manual screening and improve both efficiency and accuracy.
3. Support compliance and traceability: Record the provenance of features (e.g., regulator circulars, court cases) to support subsequent risk handling and compliance reviews.

### Core Components (Structured Content)

| Module                     | Core Content                                                                                                                        | Example                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Black-industry taxonomy    | Categorize by crime type into major/sub categories                                                                                  | Major: Money Laundering; Sub: "Multi-account small-sum aggregation ML," "Cross-border smurfing ML," "Virtual-currency ML"                        |
| Crime-pattern features     | Algorithm-identifiable key features (subject, transaction, chain, and environmental features)                                       | Transaction feature: "Many accounts → same beneficiary; small daily transfers; large cumulative amount"                                          |
| Related entities           | Entities related to illicit activity (e.g., involved companies, blacklisted accounts, high-risk countries/regions, offshore shells) | High-risk region: A tax haven; Blacklist: list of scam-involved accounts                                                                         |
| Behavioral chain templates | Typical stepwise process flow of illicit activity                                                                                   | Cross-border ML chain: "Domestic personal account aggregation → third-party payment transfer → cross-border small remittance → overseas receipt" |
| Policies and cases         | Regulatory requirements, court cases, early warnings (supporting authority and timeliness of features)                              | Regulatory: AML reporting rules for "large and suspicious transactions"                                                                          |
| Rules and weights          | Algorithmic rules based on features (e.g., "3+ features → high risk") plus feature weights                                          | Rule: "Multi-account + small-sum + cross-border → risk score ≥ 80"                                                                               |

## II. Practical Implementation in 6 Steps (From 0 to 1)

### Step 1: Define Business Scope and Core Scenarios

Prioritize the project’s core scenarios to avoid overreach and ensure practical delivery:

- Target illicit types: AML (focus on multi-account, multi-day small-sum aggregation; cross-border remittance laundering), related-party transaction fraud, offshore structures to evade regulation, etc.
- Business scenarios served: Customer onboarding screening, real-time transaction monitoring, cross-border remittance review, group customer risk scanning.
- Data scope: Cover subject data (retail and corporate), transaction data, and relationship data only (aligned with the project’s knowledge graph scope).

### Step 2: Multi-source Data Acquisition (Raw Material of the Knowledge Base)

The key is to acquire authoritative, comprehensive, and timely data—balancing internal and external sources while ensuring compliance.

#### 1. Data Source Categories

| Data Type                     | Specific Sources                                                                                   | Compliance Requirements                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Regulatory authoritative data | PBOC/CBIRC AML bulletins, police scam-related lists, international sanctions (OFAC, UN), PEP lists | Obtain via authorized official APIs; sync regularly (e.g., daily sanctions updates)                    |
| Judicial case data            | China Judgments Online and local court-published cases (e.g., ML, illegal fundraising)             | Extract case "feature" info (e.g., transaction patterns, parties); mask sensitive data                 |
| Internal historical data      | Past internal illicit-risk cases, STRs, high-risk account transactions                             | Follow internal data-security rules; keep features only, not raw sensitive PII (e.g., full ID numbers) |
| Industry-shared data          | Industry sharing platforms; third-party providers (e.g., corporate/legal data vendors)             | Execute data-usage agreements; clarify IP and permitted use                                            |
| Public media/intel            | Authoritative media reports on new patterns; anti-fraud platform updates                           | Filter non-authoritative info; keep only official or vetted media sources                              |

#### 2. Collection Methods

- Automated API integration: Regulatory lists, internal systems, third-party data via real-time or scheduled sync (e.g., nightly sanctions updates).
- Semi-automated crawling and extraction: Public cases and media via compliant crawlers (respect robots and IP); then apply NLP to extract key info.
- Human-in-the-loop input: Risk experts contribute newly observed patterns (e.g., internal cases not publicly available) via an admin UI.

### Step 3: Data Cleaning and Structuring (Raw → Semi-finished)

Raw data is often unstructured (judgments, bulletins) or semi-structured (spreadsheets). Convert it into structured data the system can interpret—the core fields of the knowledge base (e.g., illicit type, feature tags, rule conditions).

#### 1. Core Processing Steps

1. Data cleaning: Deduplication (duplicate cases/lists), denoising (irrelevant media), and masking (e.g., hide full ID numbers, phone numbers in cases).
2. Entity extraction: Use NLP (e.g., NER) to extract key entities from unstructured text:
   - Subject entities: involved company names, account numbers, high-risk countries/regions.
   - Behavioral entities: transaction types (transfer, remittance), operation styles (small-amount, cross-border).
3. Feature structuring: Map extracted info to standard fields to form feature tags. Example: From “daily transfers ≤ 50,000 for ≥ 10 consecutive days,” produce a tag “Small-amount high-frequency transfers: amount ≤ 50,000; days ≥ 10.”
4. Normalization: Standardize field formats (e.g., high-risk region to ISO country/region codes; transaction amounts to CNY). Resolve ambiguity (e.g., "张三" and "Zhang San" unified as one entity).

#### 2. Tools and Technology Choices

- Unstructured processing: Chinese NLP tools (e.g., jieba, BERT-based NER), text parsing utilities.
- Structured storage: RDBMS (e.g., MySQL) for taxonomy, rules, and subject info; plus a graph DB (e.g., Neo4j) for behavioral chains and relationships (reusing the project knowledge-graph stack).

### Step 4: Knowledge Modeling and Rule Definition (Semi-finished → Finished)

This is the core. Convert structured data into callable knowledge models and detection rules, in collaboration with risk experts.

#### 1. Knowledge Modeling (Building the Skeleton)

- Build the taxonomy: Layered "major → sub → scenario" structure (e.g., Money Laundering → Cross-border ML → Small-sum smurfing).
- Model chain templates: Translate typical illicit flows into stepwise chains stored as graphs (e.g., "Personal A → Personal B → PSP C → Offshore D" with node attributes: A domestic account, B same controller, C high-risk PSP, D offshore account).
- Assign feature weights: Experts assign weights by severity (e.g., Cross-border = 0.3, Multi-account aggregation = 0.2, Small-sum high-frequency = 0.2). Sum ≥ threshold (e.g., 0.7) → high risk.

#### 2. Rule Definition (The Soul Connecting Knowledge to Business)

Rules must be executable and tunable—two types:

- Deterministic (hard) rules: Trigger a warning when conditions are met, based on regulation or unequivocal cases (e.g., "Counterparty is on a sanctions list → directly high risk").
- Probabilistic (soft) rules: Combine features to estimate risk and capture novel patterns (e.g., "Multi-account + small-sum high-frequency + cross-border + offshore payee → score ≥ 80 → suspicious").
- Rule storage: Use a rule engine (e.g., Drools, Easy Rules) for storage and management, supporting visual configuration so experts can adjust rules and weights.

### Step 5: Link with the Knowledge Graph (Embed in the Core Architecture)

The knowledge base must integrate deeply with the project’s multimodal knowledge graph to enable automated risk matching.

#### 1. Integration Logic

1. Knowledge-base → Graph (output): Sync high-risk entities (e.g., blacklisted accounts, offshore shells), high-risk regions, and feature tags to graph node properties (e.g., mark a company node as "illicit high-risk entity").
2. Graph → Knowledge-base (input): Use graph-held customer relationships, transaction chains, and ownership structures as target data for matching (e.g., if a customer’s chain is "multi-account → cross-border → offshore payee," automatically match with "cross-border ML" features).
3. Algorithmic synergy: Graph algorithms (path analysis, community detection) extract chain features and compare them against chain templates in the knowledge base to flag suspicious patterns (e.g., match the "multi-account, multi-day, small-sum aggregation" template).

#### 2. Example Flow (Cross-border Remittance AML)

1. When a cross-border remittance occurs, the graph pulls remitter/payee accounts, amount, region, frequency, etc.
2. The system calls the knowledge base to match relevant "cross-border ML" features and rules.
3. If the match yields a score ≥ 80 (e.g., "multiple domestic accounts → same overseas payee + daily amount ≤ 50,000 + 5 consecutive days"), raise an alert to the risk system.
4. Push the alert to a visualization UI showing matched features, chain, and reference cases to support human review.

### Step 6: Dynamic Updates and Iterative Optimization (Keep It Alive)

Illicit patterns evolve. Establish a steady update mechanism to avoid staleness.

#### 1. Update Mechanisms

- Automated updates:
  - Regulatory/industry lists: Sync via APIs daily/real-time (e.g., sanctions additions auto-ingested and labeled high risk).
  - Internal risk data: Confirmed STRs in the graph lead to automatic feature extraction (e.g., identify a new chain "crypto platform transfer → cross-border remittance" and add it under "crypto ML").
- Manual updates:
  - Experts periodically (e.g., monthly) curate new patterns and add features/rules (e.g., "NFT laundering").
  - Field feedback: First-line staff report missed risks via the admin UI; experts review and update the knowledge base.

#### 2. Optimization Mechanisms

- Effectiveness evaluation: Track precision, miss rate, and false-positive rate regularly (e.g., ≥ 80% of alerts confirmed as illicit considered acceptable).
- Rule tuning: If false positives are high, adjust weights or thresholds (e.g., raise the small-amount threshold).
- Model iteration: Update NLP and graph algorithms as patterns shift (e.g., new tools emerge) to maintain extraction accuracy.

## III. Key Considerations (Avoid Pitfalls)

### 1. Compliance First

- Data compliance: Obtain authorization for external data; do not collect sensitive/infringing data. Mask personal info (e.g., keep only last 4 digits of phone numbers).
- Rule compliance: Rules must conform to AML Law, Data Security Law, etc. Avoid overbroad definitions of high-risk entities.

### 2. Reuse the Existing Architecture

- Avoid duplicative build: Reuse the project’s graph stack for storing chains and relationships; no separate deployment needed.
- Unified interfaces: Use consistent standards (e.g., RESTful APIs) for integration with internal systems and the graph.

### 3. Usability by Design

- Visual admin: Provide a back office UI for experts to CRUD features, rules, and cases without developer involvement.
- Explainability: For each alert, show matched features, reference cases, and rule basis so reviewers understand the rationale.

### 4. Fault Tolerance

- Missing data handling: If some transaction fields are missing (e.g., region), perform fuzzy matching on available features (e.g., multi-account + small-sum) rather than ignoring the event.
- Gray-release rules: Roll out new rules to a subset first (e.g., 10% of traffic), assess, then expand to full scale to minimize business impact.

## IV. Summary

The essence of a Black-Industry Knowledge Base is to structure and operationalize illicit-risk knowledge and integrate it deeply with the knowledge graph—turning expert experience into executable logic.

Focus on core scenarios first (e.g., AML and cross-border risk). Use compliant multi-source data to build the foundation; apply NLP + rule engines for structuring and automation; then keep it dynamic with continuous updates. The result is stronger risk identification and alerting that addresses the pain points of novel-pattern detection and low manual-screening efficiency.
