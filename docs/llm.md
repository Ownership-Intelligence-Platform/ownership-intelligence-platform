Starting (1/7) _Analyze LLM requirements_

Starting (2/7) _Add provider-agnostic LLM client_

Here’s a structured, business-to-technical analysis and a pragmatic implementation roadmap for adding LLM functions to your project, grounded in the two requirement documents.

## 1. Mapping business pain points to LLM feature candidates

1. Accelerated Customer Due Diligence (CDD)

   - LLM-generated CDD snapshot reports (entity profile + key relations + risk narrative + recommended next actions).
   - Natural-language explanations of ownership penetration (UBO tracing reasoning).
   - Interactive Q&A: “Explain why Entity E23 is high risk” / “List top 3 guarantee exposures.”

2. Name Screening Upgrade

   - LLM-backed variant expansion: propose pinyin, abbreviation, homophone, offshore alias candidates.
   - False positive triage: LLM summarizes why a fuzzy match is or isn’t the same entity.

3. Related-Party / Risk Propagation Analysis

   - Narrative synthesis of multi-hop transaction/guarantee chains (turn raw paths into human-readable reasoning).
   - “What could happen if guarantor G1 defaults?” – scenario narration using graph topology + heuristic rules.

4. Emerging Risk & Black Industry Knowledge Base

   - Pattern summarization: ingest structured rule hits + example transactions; LLM produces human-readable pattern briefs.
   - Gap spotting: LLM suggests new potential heuristic features (“Frequency normalized by active days,” etc.).

5. Cross-border AML & Small-amount Aggregation

   - Chain summarization (“14 transfers over 6 days across 4 accounts; pattern resembles smurfing”).
   - Red flag storytelling for compliance review.

6. Automated Decision Loop
   - Decision recommendation section: “Preliminary action: escalate to enhanced due diligence” with rationale.
   - Report templating with parameterized “tone” (formal/regulatory vs internal analyst summary).

## 2. Core LLM functional modules (recommended initial scope)

Priority (Phase 1):

- Report Generation Service (CDD snapshot).
- Name Variant Expansion & Screening Explanation.
- News Summarization (aggregate stored + external news to sentiment/risk brief).
- Risk Narrative Generator (turn structured risk_service output into prose).

Phase 2:

- Interactive Q&A endpoint (retrieval + graph augmentation).
- Scenario Reasoner (simulate propagation or default outcomes).
- Pattern Evolution Assistant (suggest new KB rule candidates).

Phase 3:

- Multi-turn Analyst Assistant (session memory).
- Fine-tuning or structured few-shot prompt library for domain style.
- Evaluation harness for consistency, hallucination rate, and compliance filters.

## 3. Architectural design

Layered approach:

1. Data Collection Layer (already present)

   - Graph queries (entity details, neighbors, ownership paths, guarantees, transactions).
   - Risk KB evaluation results.
   - News items (stored + external).

2. Assembly Layer

   - New `report_service.py`: fetch & transform raw data into canonical structured “report bundle”:
     {
     entity: {...},
     ownership_penetration: {...},
     relationships_summary: [...],
     risk_summary: {...},
     news_items: [...],
     screening_matches: [...],
     graph_metrics: {...},
     generation_context: {...}
     }

3. Prompt Construction Layer

   - Deterministic JSON→prompt: Convert bundle into sections with controlled formatting.
   - Use “guard rails” (max tokens per section; truncate long lists; deterministic ordering).

4. LLM Client Abstraction

   - `llm_client.py` wrapping OpenAI-compatible endpoints (your existing `qwen-plus` example) with:
     - Provider selection via env: MODEL_NAME, LLM_BASE_URL, LLM_API_KEY.
     - Retry, timeout, streaming support (optionally).
     - Safety filters (regex / rule-based removal of sensitive PII before sending if required).

5. Output Post-Processing

   - Validate structure: extract fenced sections if model returns them.
   - Basic hallucination guard:
     - Check entity IDs referenced appear in supplied context.
     - Flag unknown entity references for warning banner.
   - Markdown + optional HTML rendering (embed small SVG graph).

6. Persistence and Caching

   - Save final report to `reports/{entity_id}_{date}.md`.
   - Caching key = hash of core structured bundle + model + version; provide bypass flag.

7. Evaluation / Observability
   - Log prompt token count, output token count, generation latency.
   - Store minimal trace (prompt hash) for reproducibility.

## 4. Suggested directory additions

- `app/services/llm_client.py` (thin abstraction)
- `app/services/report_service.py`
- `app/services/prompt_templates.py` (central template strings + variable substitution)
- `app/api/routers/reports.py`
- `reports/` (new folder, git-tracked except large generated artifacts)
- `app/eval/` (future: evaluation scripts, confusion matrix for screening, factuality checks)

## 5. Prompt engineering strategy

General principles:

- Provide structured blocks: <ENTITY_PROFILE>, <OWNERSHIP>, <RISK_ITEMS>, <NEWS>, <SCREENING>.
- Use explicit instructions for tone, language (Chinese/English bilingual if needed), compliance disclaimers.
- Few-shot examples for:
  - Risk narrative style (short, actionable).
  - Ownership explain (“Entity A indirectly controls Entity C through B (51% + 40%).”).
- Force output sections markers:
  REPORT:
  SECTION: SUMMARY
  SECTION: OWNERSHIP
  SECTION: KEY_RISKS
  SECTION: NEWS_BRIEF
  SECTION: RECOMMENDATIONS

Validation routine: ensure all required sections appear; fallback to deterministic generation if one is missing.

## 6. Safety / Compliance considerations

- Mask personally identifiable info if policy requires (e.g., passport numbers).
- Avoid sending full transaction raw logs to LLM—summarize numeric stats locally.
- Add allowlist for fields sent; block unknown fields.
- Maintain a “no external calls” flag for offline mode (skip LLM, generate template-only report).
- Audit log each generation: who triggered (future), timestamp, entity id, model version, prompt hash.

## 7. Evaluation plan (initial)

Metrics:

- Structural validity: % of generated reports with all sections.
- Factual consistency: sample manual checks comparing ownership chain claims vs graph query results (automatable via regex extraction).
- Latency: target < 4 seconds per report on typical context size.
- Hallucination rate: count of references to unknown entity IDs / risk labels not in input.
- Screening explanation clarity: analyst 1–5 rating, target ≥4 average.

Tooling:

- Add a dry-run test that mocks llm_client returning deterministic canned text; integrate into pytest to ensure pipeline doesn’t break.

## 8. Incremental implementation roadmap

Phase 1 (Core):

1. Implement `llm_client.py` (env config, simple `generate(prompt, max_tokens)`).
2. Implement `prompt_templates.py` with a Jinja2-free, string-format approach (avoid extra deps initially).
3. Implement `report_service.py`:
   - fetch data via existing services
   - build structured bundle
   - build prompt
   - call LLM
   - validate & save
4. Add router `reports.py`:
   - GET `/reports/cdd/{entity_id}?refresh=false&format=html`
   - If cached & refresh false, return existing.
   - HTML: convert markdown via lightweight library (optional second step).
5. Update README (env vars: MODEL_NAME, LLM_API_KEY, LLM_BASE_URL).
6. Add a pytest for `report_service` with mocked `llm_client.generate`.

Phase 2 (Enhancements):

1. Name variant expansion endpoint POST `/screening/expand` using a structured prompt with examples.
2. News summarization inclusion (re-query news items and produce sentiment/risk tags).
3. Add risk recommendation classification (e.g., “AUTO-APPROVE | MANUAL-REVIEW | ENHANCED-DD”).

Phase 3:

1. Interactive Q&A endpoint: POST `/qa` with `question` & `entity_id`.
2. Retrieval augmentation: hydrate context chunks (shortest paths, top 5 guarantees, etc.).
3. Add evaluation scripts to measure hallucinations.

## 9. Minimal contract definitions

LLM client:

- Input: prompt (str), model (optional override), max_tokens (int)
- Output: { text: str, usage: { prompt_tokens, completion_tokens }, model: str }

Report service result:

- Input: entity_id (str), refresh (bool)
- Output: { entity_id, path, cached: bool, sections: { summary, ownership, risks, news, recommendations }, meta: { model, latency_ms } }

Variant expansion:

- Input: { name: "张三", locales: ["zh", "en"], include_pinyin: true }
- Output: { canonical: ..., variants: [{ value, type, confidence }], prompt_tokens, completion_tokens }

## 10. Edge cases & fallback behavior

Edge cases:

- Entity not found: 404 early exit from router.
- Empty relations: ownership section should state “No ownership layers found within depth N.”
- LLM failure (timeout/HTTP error): fallback to deterministic template (simple bullet list from raw data).
- Oversized prompt (token budget breach): truncate news summaries first, then long transaction lists.

Fallback template snippet example (no LLM):
CDD Report (Deterministic)
Entity: {name} ({id})
Ownership: Depth {depth} – {num_layers} layers found.
Top Risks: {risk_labels} (raw score {overall_risk_score})
News: {count} articles (negative flags: {negative_news_count})
Recommendations: Manual review due to missing AI narrative (LLM unavailable).

## 11. Dependency and tooling adjustments

- Already using `openai` in pyproject.toml; add consistent version to requirements.txt or converge to single dependency source.
- Optional additions later:
  - `markdown` or `md2html` for HTML conversion.
  - `tenacity` for retry (or implement minimal manual retry loop).
  - `cachetools` for in-memory report cache.

## 12. Security & cost management

- Rate limiter on generation endpoints (e.g., per entity per hour).
- Optional queue for bulk report generation.
- Token budgeting: approximate tokens before sending (character→token heuristic).
- Include model usage metadata in response; store aggregated daily usage counters.

## 13. Future extensions (post-MVP LLM)

- Chain-of-thought optional toggle (internal only) to explain reasoning in a hidden section.
- Fine-tune / adapter (LoRA) for domain-specific phrasing if volume justifies.
- Multi-model routing (fast cheap model for variant expansion; larger model for reports).
- Guardrail classification using a small local model (e.g., flags prohibited content in generated narrative).

## 14. Actionable next steps (immediate)

1. Confirm dependency unification strategy (choose pyproject or requirements.txt).
2. Create scaffolding files (llm_client, report_service, reports.py router).
3. Add environment variable documentation to README.
4. Implement deterministic fallback path & test.
5. Run tests; add new tests for report bundle assembly.

If you’d like, I can proceed to scaffold the initial LLM client + report service in the codebase. Just say “Go ahead” and I’ll implement Phase 1.

Let me know if you prefer any specific provider (sticking with Qwen vs adding OpenAI fallback) or if bilingual (zh/en) output should be default.
