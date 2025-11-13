I'll set up a lightweight todo plan to structure the analysis and keep you updated as I cover each part.

Created 5 todos

Progress update: I created a focused todo plan and started with clarifying goals; next I’ll assess how your current stack maps to GraphRAG and then propose concrete integration architectures.## What “GraphRAG” means here

GraphRAG = retrieval that uses graph structure (entities + relationships + community summaries) alongside text chunks to ground LLM answers. For this repo, it should:

- Use your existing Neo4j graph (entities, ownerships, networks) as the primary retrieval substrate.
- Fuse evidence from the graph (nodes/paths/communities) and unstructured text (news/articles) into prompts.
- Prefer precise, path-aware reasoning (who-owns-whom, penetration paths) and cite sources.
- Stay cost-aware with precomputed summaries and bounded subgraph retrieval.

Success criteria

- Accuracy: answers reflect the graph truth; low hallucination; explicit citations to nodes/news.
- Coverage: handles ownership questions, person networks, supply chain/transactions, and risk signals.
- Latency: P50 < ~2.5s for short Q&A (without global context); P95 < ~8s with global/community context.
- Cost: predictable token spend via caching and summary reuse.
- Maintainability: minimal changes to existing routers and services; reusable components.

Constraints and assumptions

- Windows + PowerShell dev, FastAPI backend, Neo4j driver 5/6, APScheduler available.
- LLM via existing `llm_client.py` (OpenAI-compatible, supports DashScope/Qwen).
- Unstructured content available via news crawl/import; can add “Document” layer if needed.
- You don’t need implementation right now—just an actionable plan.

## How your current stack maps to GraphRAG

- Neo4j graph = the core knowledge graph
  - Already stores entities, ownerships, legal reps, transactions, etc.
  - Ideal for k-hop, typed-path, and community retrieval (via Cypher or GDS).
- News/service + crawl = unstructured evidence
  - Can be linked to entities via MENTIONS/REFS edges; usable for citations and fact grounding.
- APScheduler = indexing/summarization jobs
  - For building node/community/event summaries and refreshing embeddings.
- LLM client = prompting and summarization
  - Shared client across summarization pipelines and Q&A.
- Routers (`chat`, `analysis`, reports) = integration surfaces
  - Easiest entrée is “GraphRAG mode” on existing `/chat`.
- Static UI = toggles and visualization
  - Add a mode switch and show retrieved subgraphs + summaries + citations.

Gaps to fill

- Document layer and entity-document linkage (if not already present).
- Summaries: node-level and community-level; optional event-level.
- Embeddings (for hybrid retrieval) and/or GDS features for community detection.
- A retrieval orchestrator that decides local vs global context and composes prompts.

## Two viable integration paths

1. Neo4j-native GraphRAG (recommended for you)

- Retrieval: Cypher/GDS for k-hop expansion, typed paths (OWNERSHIP, TRANSACTION, SUPPLY), and community detection.
- Summaries: store in Neo4j as separate nodes (e.g., CommunitySummary, NodeSummary) or as properties.
- Evidence: mix of subgraph triples and news passages; include deterministic Cypher for repeatability.
- Pros: Leverages your existing graph; transparent; fewer moving parts.
- Cons: You’ll own the summarization/index pipelines.

2. Adopt Microsoft’s GraphRAG pipeline (microsoft/graphrag) or LlamaIndex GraphRAG

- Indexing: off-the-shelf community detection + global/local summaries from unstructured text.
- Retrieval: global summaries + local context assembly.
- Pros: Faster to prototype with text-first GraphRAG; strong docs for global context retrieval.
- Cons: Their pipeline is text-centric and file-backed by default; you’ll still need to sync with Neo4j or adapt storage.

Recommendation: Start Neo4j-native; you already have a rich graph and CSV pipelines. You can still borrow ideas from microsoft/graphrag (global vs local context, community summaries).

## Architecture blueprint (minimal → full)

Phase A: Minimal GraphRAG (1–2 weeks)

- Retrieval
  - Anchor detection: resolve main entities in questions (reuse `/entities/resolve`).
  - Local subgraph: bounded k-hop (e.g., depth=2) with typed edges and degree limits.
  - Evidence selection: top-N nodes by degree/PageRank; top M paths by significance.
- Prompting

  - Compose “local” context: key nodes (name, type, roles), selected paths, small counts.
  - Add 2–3 news snippets linked to anchors (if present).
  - Ask model for:

    Inputs: user question, local subgraph triples, key paths, optional news snippets
    Outputs: concise answer + bullet evidence with citations (node IDs, news URLs)
    Error modes: no anchors found → ask clarifying; empty subgraph → say insufficient data and suggest next query

- Storage
  - Optional: Node-level summaries per important entity (cached text property like summary_v1).
- API
  - Extend `POST /chat` with mode=graphrag and retrieval params (depth, max_nodes, max_paths).
- Cost controls
  - Token budget caps; truncate context deterministically; cache per-anchor summaries.

Phase B: Global context GraphRAG (community-aware)

- Indexing jobs (APScheduler)
  - Community detection (GDS Louvain/Leiden) for anchors; store Community nodes with membership edges.
  - Generate community summaries with LLM; version and cache them; include top representative entities/relations.
- Retrieval
  - Add “global” section: community summary for each anchor’s main community (or overlapping communities).
  - Merge with local context; dedupe facts.
- Storage
  - New labels: Community, CommunitySummary; relations: MEMBER_OF, SUMMARIZES.
- API
  - GET `/graphrag/community/{entity_id}` (debug/inspection).
- Cost controls
  - Batch summarize communities; only refresh on significant deltas (degree/membership change thresholds).

Phase C: Hybrid Graph + Text GraphRAG (unstructured evidence)

- Document layer
  - Nodes: Document (news/articles) with properties: title, url, published_at, text (or content hash).
  - Edges: MENTIONS(Entity), SUPPORTS(Relationship) when extracted.
- Retrieval
  - For each path, fetch k supporting passages; rank by recency and source credibility.
- Summaries
  - Event-level summaries (optional) aggregating multi-doc event threads.
- Evaluation
  - Benchmarks on path correctness, claim grounding, and citation precision.

## Data model extensions in Neo4j

- Node labels
  - Community: {community_id, algorithm, version, size}
  - CommunitySummary: {text, version, model, tokens_in, tokens_out, created_at}
  - Document: {title, url, published_at, source, content_hash, ...}
  - NodeSummary (optional): {entity_id, text, version, ...}
- Relationships
  - MEMBER_OF: (Entity)-[:MEMBER_OF]->(Community)
  - SUMMARIZES: (CommunitySummary)-[:SUMMARIZES]->(Community)
  - MENTIONS: (Document)-[:MENTIONS]->(Entity)
  - SUPPORTS: (Document)-[:SUPPORTS]->(Relationship) or to a synthetic “Claim” node if you create one

## Retrieval orchestration (contract and edge cases)

Contract

- Inputs: { question, optional entity_ids, retrieval_mode: local|global|hybrid, depth, caps }
- Processing:
  1. Anchor resolution (NER or `/entities/resolve`).
  2. Local subgraph: k-hop typed paths with size limits.
  3. Optional global summaries for anchor communities.
  4. Optional document snippets supporting top paths.
  5. Prompt assembly with strict token budget.
- Outputs: { answer, citations: [node_ids, path_ids, doc_urls], model, usage }

Edge cases to handle

- No anchor found or ambiguous entities → ask a targeted clarifying question.
- Large-degree hubs → cap degree per node; sample by weight.
- Highly dense subgraphs → prioritize typed paths relevant to the intent (ownership vs supply).
- Stale summaries → refresh on schedule or threshold-based triggers.
- API limits/timeouts → use degradation: local only → text-only fallback → “insufficient data”.

## API surfaces (non-implementing outline)

- POST `/chat` (existing): add body fields
  - mode: "graphrag" | "vanilla"
  - retrieval: { depth, max_nodes, max_paths, include_global, include_docs }
  - response: { answer, citations, retrieval_info }
- POST `/graphrag/index/run` (admin-only)
  - triggers community detection and summary jobs (optional).
- GET `/graphrag/community/{entity_id}`
  - returns community summary, members, and metadata.

Pydantic models (high-level)

- GraphRagQuery, GraphRagRetrievalOptions, GraphRagAnswer
- CommunitySummary, DocumentSnippet, PathEvidence

## Prompting patterns

- Local mode prompt (ownership intent)

  - System: “Use only provided graph facts and quoted passages. Prefer precise ownership paths.”
  - Context sections:
    - Entities: id, name, type, key attributes
    - Paths: up to M paths (entityA —[OWNERSHIP x%]→ entityB …)
    - News snippets: short quotes + URLs
  - Instructions: produce answer + bullet list of evidence with explicit node IDs and URLs.

- Global + local prompt
  - Add CommunitySummary (“Global context”) above the local sections.
  - Ask the model to reconcile global narrative with local facts; do not extrapolate beyond evidence.

## Cost, performance, and ops

- Keep summaries short (<= 200–300 tokens).
- Cache summaries and retrieval results keyed by (anchor(s), retrieval params).
- Bound local expansion: depth ≤ 2, node cap ≤ 150, path cap ≤ 30 for interactive UI.
- Paging for heavy queries (e.g., background report generation can raise caps).
- Observability: log retrieval sizes, tokens, model names, latency per stage.

## Evaluation plan

Datasets

- Curate 50–100 questions across:
  - Ownership (direct/indirect stakes), control chains, ultimate beneficiaries
  - Person networks, related entities, guarantees, supply chain, transactions
  - Risk questions blending news + graph facts

Metrics

- Faithfulness/groundedness (manual rubric + small LLM-as-judge with trace).
- Path correctness (Cypher recomputation).
- Citation precision/recall (# of claims with correct supporting evidence).
- Latency and token usage per query.

Harness

- Add pytest suites that:
  - Build tiny graphs from fixtures.
  - Exercise retrieval assembly (no external LLM needed) and validate prompt contents.
  - For end-to-end, stub the LLM to check format, not semantics.

## Rollout milestones

- Week 1

  - Minimal local GraphRAG in backend (retrieval + prompting) behind `mode=graphrag`.
  - Add node-degree caps, caching, and basic citations.

- Week 2

  - Community detection + community summaries (scheduled).
  - “Global context” merged into prompts.
  - UI toggle and evidence panel.

- Week 3–4
  - Document layer with MENTIONS/SUPPORTS edges from news.
  - Add event-level summaries (optional).
  - Expand evaluation set and tighten cost controls.

## Risks and mitigations

- Token cost blowups → strict budgets, caching, short summaries.
- Overfitted global summaries → versioning, thresholds for refresh, source diversity.
- Ambiguity in entity resolution → show top candidates in UI and ask the user to confirm.
- Latency spikes from heavy subgraphs → progressive disclosure (local first, then global), async prefetch.

## Next steps (when you’re ready to implement)

- Decide on Path A (Neo4j-native) vs Path B (microsoft/graphrag or LlamaIndex).
- Lock initial retrieval parameters (depth, caps) and summary sizes.
- Define the Neo4j schema additions (Community, Document, Summary nodes/edges).
- Add evaluation questions and acceptance checks.

If you want, I can turn this into a concrete change plan for the repo (files to touch, skeleton endpoints, and Cypher queries) without writing code yet.
