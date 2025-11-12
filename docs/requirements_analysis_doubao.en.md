# Software Project Requirements Deep-Dive Analysis Report

## I. Core Business Pain Points (Current-State Diagnosis)

The client's core need stems from four bottlenecks in traditional, human-driven customer risk management: low efficiency, narrow coverage, slow alerts, and poor accuracy. These crystallize into the following four dimensions and define the project's "core pain points" to solve:

### 1. Customer Due Diligence (CDD): Manual workflows cause inefficiency and omissions

- Current issues: Verification across business registration, judicial, tax, and other basic data is performed manually, taking days per case. Human review struggles with complex relationships and easily misses hidden risks (e.g., indirect equity links, implicit guarantees).
- Core ask: Replace manual checking with automation to compress the due diligence cycle from days to hours/minutes, reduce human omissions, and improve coverage/completeness.

### 2. Name Screening: Single-dimension matching creates blind spots

- Current issues: Relying only on name similarity for blacklist matching fails to capture special variants—such as pinyin variations (e.g., "Zhang San" vs. "San Zhang" vs. "Zhang Shan"), abbreviations (e.g., "ABC Group" vs. "ABC Co., Ltd." vs. "A.B.C. Group"), and decomposed entities in offshore structures (e.g., Cayman parent vs. onshore subsidiaries with same/variant names).
- Core ask: Upgrade matching logic beyond literal similarity to achieve "semantic + variants + structure look-through" precision, covering sanctions lists, PEPs (politically exposed persons), and other high-risk entities.

### 3. Related-Party Transaction Analysis: Manual decomposition leads to misses and lagging alerts

- Current issues: Guarantee circles and supply-chain nesting require manual mapping, making it hard to quickly identify complex networks; major risk propagation alerts arrive 72+ hours late, missing mitigation windows.
- Core ask: Automatically mine related-party networks (guarantees, supply chain, equity, etc.) to enable real-time/near-real-time risk propagation alerts and shorten response time.

### 4. Emerging Risk Detection: Lacks a systematized foundation

- Current issues: No unified knowledge base for new illicit-industry patterns; AML scenarios like "many accounts—many days—small amounts" fund aggregation rely on manual identification, which is inefficient and inaccurate.
- Core ask: Build a black industry (illicit activity) knowledge base to automatically identify emerging fraud/crime patterns; enhance AML analysis for cross-border remittances and small-amount aggregation to improve accuracy.

## II. Core Functional Requirements (Solution Positioning)

Based on the pain points above, the core solution is a multimodal knowledge graph empowered by AI. It decomposes into eight core modules to clarify "what to build" and "what success looks like":

### 1. Multimodal Knowledge Graph Construction (foundational capability)

- Data sources: Integrate multiple sources: internal systems (core systems, transaction systems) and external systems (business registry, judiciary, tax, cross-border data, sanctions lists, etc.).
- Integrated content: Customer background (basic info, qualifications, risk level), transaction history (corporate/retail, cross-border remittances), organizational structure (org chart, branches), equity relations (direct/indirect holdings and percentages), upstream/downstream parties (supply-chain partners, counterparties), etc.
- Core goal: Build a unified, structured customer knowledge graph that breaks down data silos and supports all subsequent analytics.

### 2. Graph-Algorithm-Driven Risk Detection (knowledge graph applications)

- Core capabilities: Apply graph algorithms (community detection, shortest paths, risk propagation, high-risk node scoring, etc.) to automatically analyze the knowledge graph.
- Detection targets:
  - Potential related parties (e.g., hidden equity ties, indirect guarantee links, actual control relations in offshore structures);
  - High-risk nodes (e.g., listed entities, highly leveraged firms, litigated entities and their neighbors);
  - Complex transaction networks (e.g., guarantee circles, nested supply chains, "many accounts—many days—small amounts" aggregation networks).
- Service scenarios: Provide decision support for CDD and AML, including onboarding screening and CSEM (enhanced due diligence) checks.

### 3. Group-Client Related Transactions Mining (specialized analysis)

- Scope: Intra-group cross-entity transactions, group-to-external related-party transactions, and cross-border related transactions (including remittances).
- Core goal: Visualize related transaction chains for group clients, identify abnormal related transactions (e.g., non-commercial transfers, regulatory evasion via affiliates), and support compliance reviews and early warnings.

### 4. Enhanced AML for Cross-Border Remittances (specialized risk control)

- Analysis scenarios: Identify cross-border counterparties, trace fund flows, and validate transaction purposes.
- Core capabilities: Detect the typical AML pattern of "many accounts—many days—small amounts" aggregation; automatically flag anomalies (e.g., frequent split remittances, flows to high-risk countries/regions, counterparties that are offshore shell companies).
- Core goal: Improve automation and accuracy in cross-border AML analysis and reduce missed and false alarms.

### 5. Black Industry Knowledge Base and Matching (risk system capability)

- Knowledge base contents: Aggregate emerging illicit-industry patterns (telecom fraud, online gambling, illegal fundraising fund flows), typical risk features (transaction, account, and entity features), and regulatory requirements.
- Core capabilities: Support automatic matching by comparing clients’ transaction behaviors and entity information against knowledge-base patterns to auto-flag suspected risks.
- Core goal: Achieve rapid identification and dynamic updates of new black-industry risks, adapting to fast-evolving patterns.

### 6. Name Screening Upgrade (precision matching)

- Technical support: Introduce NLP techniques (semantic understanding, entity recognition, variant normalization, fuzzy matching).
- Matching dimensions: Go beyond literal similarity to cover:
  - Pinyin variants (full/abbreviated pinyin, reversed order, homophones);
  - Abbreviations/short names (official, industry, custom);
  - Offshore-structure associations (e.g., linking Cayman entities and onshore subsidiaries, ties via ultimate beneficial owner).
- Matching objects: Sanctions lists, PEP lists, and high-risk entities (e.g., litigated enterprises, defaulters).
- Core goal: Raise recall (fewer misses) and precision (fewer false positives) in list matching and reduce manual review burden.

### 7. Global Entity Association Network (look-through analysis)

- Core capabilities: Look through offshore corporate structures (Cayman, BVI, Bermuda, etc.) to trace the ultimate beneficial owner (UBO).
- Analytic content: Equity relations, control relations, and transaction relations among offshore entities and onshore/offshore entities; assess UBO risk (e.g., PEP status, blacklist links).
- Core goal: Resolve ambiguity around UBOs in offshore structures and prevent regulatory evasion risks (money laundering, capital flight).

### 8. Automated Decision Loop and Report Generation (efficiency booster)

- Technical support: Based on generative AI (e.g., ChatGLM).
- Core capabilities:
  - Automatically generate Customer Risk Due Diligence Reports without manual writing;
  - Reports include visualizations and analytic conclusions: equity look-through graphs, related-transaction chains, early warning conclusions (e.g., high-risk nodes, potential propagation paths), and due-diligence outcomes (e.g., approve onboarding or require enhanced checks).
- Core goal: Dramatically accelerate report authoring (from days to hours/minutes), provide visual, actionable decision support, and form an automated loop of data collection → analysis → alerting → reporting → decision.

## III. Core Technical Requirements (Implementation Positioning)

The project hinges on a knowledge graph + AI stack. Key technologies and KPIs are required to land the solution:

### 1. Data Layer

- Multi-source integration: Support structured (registration, transaction records), semi-structured (announcements, contract abstracts), and unstructured (news sentiment, court rulings) data collection and fusion.
- Data cleansing and standardization: Address heterogeneity (inconsistent field names, formats) and achieve entity resolution/normalization (unifying multiple names for the same enterprise).

### 2. Knowledge Graph Technology

- Graph build and updates: Support incremental updates (e.g., real-time transaction or business-registration changes) to ensure timeliness.
- Storage and query: Handle large-scale graph data (tens/hundreds of millions of nodes/edges) with efficient storage and millisecond-level queries (e.g., quickly list all a firm’s related parties).

### 3. AI Algorithms

- Graph algorithms: Include mature algorithms (community detection, risk propagation, node scoring) with tunable parameters for business fit.
- NLP: Entity recognition, semantic matching, variant normalization, and fuzzy matching with precise handling of Chinese, English, and pinyin.
- Generative AI: Generate structured, logically coherent due diligence reports grounded in knowledge-graph data and analytic outputs, with accuracy and compliance guarantees.

### 4. Visualization

- Support interactive visualization of complex networks (equity look-through, related-transaction chains, guarantee circles) with zoom, drill-down, and node/edge filtering.
- Visualize early warning outputs (e.g., highlight high-risk nodes and propagation paths).

## IV. Business Value and Application Scenarios (Outcome Positioning)

Clarify the core business problems solved and the key application scenarios to highlight value:

### 1. Core Business Value

- Efficiency: Compress CDD cycle from days to hours/minutes; improve report authoring efficiency by 80%+; reduce manual cost.
- Risk coverage: Eliminate blind spots in name screening, related-transaction oversight, and offshore look-through; push risk detection coverage to 90%+.
- Faster alerts: Shorten major risk propagation alerts from 72+ hours to real-time/near-real-time to improve mitigation.
- Compliance: Meet CDD, AML, and CSEM requirements and reduce compliance penalties (e.g., AML under-reporting fines).

### 2. Core Application Scenarios

- Onboarding screening: Automatically screen high-risk customers during account opening (blacklist links, PEPs, litigated entities) and block high-risk onboarding.
- Customer Due Diligence (CDD): Auto-generate due diligence reports to support human review and improve quality and efficiency.
- Anti-money laundering (AML) monitoring: Identify aggregation (many accounts—many days—small amounts), cross-border anomalies, and auto-alert.
- Group-client risk management: Mine risks in intra-group related transactions and guarantee circles to prevent risk propagation.
- High-risk entity screening: Real-time matching against sanctions and PEP lists; identify high-risk UBOs under offshore structures.

## V. Implicit Requirements and Considerations

Beyond explicit needs, focus on the following to avoid rework:

### 1. Data Compliance

- External data (registry, judiciary, cross-border) collection must comply with the Data Security Law and Personal Information Protection Law; ensure lawful sourcing and compliant use (e.g., de-identification).
- Sanctions and PEP lists must be updated regularly to ensure timeliness.

### 2. System Integration

- Seamlessly integrate with the client’s internal systems (core, transaction, CRM) for real-time sync to avoid new silos.
- Support interfacing with external data providers (registry data services, cross-border data platforms).

### 3. Scalability

- Black industry knowledge base must support dynamic updates: manual entry of new patterns and automatic ingestion from regulatory bulletins and industry cases.
- Graph algorithms must be extensible to add new models (e.g., supply-chain-specific risk models) as needs evolve.

### 4. Usability

- Visual UI must be simple and intuitive for non-technical users (risk and due-diligence staff), supporting quick drill-down and filtering.
- Report generation must support customizable templates (to meet different regulatory requirements and client types).

### 5. Accuracy and Fault Tolerance

- NLP matching and graph analysis must deliver high accuracy (e.g., ≥95% match accuracy for list screening) and support human review/correction (e.g., manual override of misclassified nodes).
- Provide fault tolerance for missing/erroneous data (e.g., perform fuzzy analysis with partial fields).

## VI. Summary

The project’s core is a multimodal knowledge graph as the data foundation, empowered by NLP + graph algorithms + generative AI to fix traditional customer risk management pain points of inefficiency, blind spots, lag, and inaccuracy. The end state is automated, precise, and real-time customer risk control that supports CDD and AML while boosting compliance and efficiency.

Success hinges on four priorities: compliant and real-time data integration; accurate matching and analysis algorithms; seamless system integration with existing platforms; and ease of use tailored to business users. These must be clarified first, then the technical design should proceed.
