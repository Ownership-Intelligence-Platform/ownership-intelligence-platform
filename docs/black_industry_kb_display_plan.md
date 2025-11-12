# Black-Industry KB Display & UX Plan (MVP Extension)

This document extends the MVP implementation plan to cover the _display layer_ (frontend + explanatory UI) for the Knowledge Base risk evaluation.

## 1. Display Objectives

Provide a clear, interpretable visualization of KB-driven risk results alongside existing heuristic risk analysis:

- Show overall KB risk score and triggered rule categories.
- List deterministic triggers prominently (e.g., sanctions hit).
- Show weighted rule evaluations with feature contribution breakdown.
- Provide an explanation summary for quick human triage.
- Allow side-by-side comparison with existing heuristic sections (accounts, transactions, news, etc.).

## 2. Proposed UI Additions (Cards & Sections)

Add a new card under the existing "Risk Analysis" card:

**Card: KB Risk Evaluation**

- Input Elements:
  - Toggle: Use Root Entity vs Custom Transaction Chain.
  - Textarea (hidden by default): JSON input for ad-hoc chain evaluation (advanced users).
  - Button: "Evaluate KB Risk".
- Output Container: `#kbRiskResults` for structured HTML.
- Optional: Collapsible area for raw JSON response.

**Subsections inside the card:**

1. Summary line: `Score: <number> | Labels: [aml, aml.ssa] | Deterministic: [sanctions_hit]`.
2. Deterministic triggers list (if any) with icon (e.g., red ⚠️).
3. Weighted rules table:
   | Rule ID | Category | Matched Features | Raw Weight Sum | Threshold | Passed? |
4. Feature contributions heat strip (simple horizontal bar where each matched feature block displays its weight).
5. Explanation paragraph.
6. Action buttons:
   - "Annotate Graph" (calls `/risk/annotate-graph` for current entity).
   - "View Raw" (toggle raw JSON preformatted block).

## 3. Data Flow

1. User clicks "Evaluate KB Risk".
2. Frontend collects entity id (already resolved) and optionally a chain JSON sample.
3. POST to `/risk/evaluate` with body: either `{ "entity_id": "X" }` or `{ "transfers": [...], "beneficiary_name": "..." }`.
4. Receive response (Evaluation Output Contract). Render summary & details.
5. On annotate, POST `/risk/annotate-graph` with `{ "entity_ids": ["X"] }` then show toast / inline status.

## 4. Rendering Logic (Pseudo-code)

```js
function renderKbRisk(data) {
  const parts = [];
  parts.push(
    `<div class='text-sm mb-2'><strong>Score:</strong> ${data.score} ` +
      `| <strong>Labels:</strong> ${data.labels.join(", ") || "None"} ` +
      `| <strong>Deterministic:</strong> ${
        data.deterministic_triggers.join(", ") || "None"
      }</div>`
  );

  if (data.deterministic_triggers.length) {
    parts.push(
      `<div class='mb-3'><h4 class='font-semibold'>Deterministic Triggers</h4>` +
        `<ul class='ml-4 list-disc'>` +
        data.deterministic_triggers
          .map((r) => `<li class='text-red-600'>${r}</li>`)
          .join("") +
        `</ul></div>`
    );
  }

  if (data.weighted_details) {
    parts.push(
      `<table class='w-full text-xs border mb-3'>` +
        `<thead><tr class='bg-gray-100 dark:bg-gray-800'>` +
        `<th class='p-1 text-left'>Rule</th><th class='p-1 text-left'>Category</th><th class='p-1'>Matched Features</th>` +
        `<th class='p-1'>Score</th><th class='p-1'>Threshold</th><th class='p-1'>Passed</th></tr></thead><tbody>` +
        data.weighted_details
          .map(
            (w) =>
              `<tr>` +
              `<td class='p-1'>${w.id}</td>` +
              `<td class='p-1'>${w.category}</td>` +
              `<td class='p-1'>${w.matched_features.join(", ") || "-"}</td>` +
              `<td class='p-1'>${w.raw_score.toFixed(2)}</td>` +
              `<td class='p-1'>${w.threshold}</td>` +
              `<td class='p-1'>${w.passed ? "✅" : "—"}</td>` +
              `</tr>`
          )
          .join("") +
        `</tbody></table>`
    );
  }

  // Explanation
  parts.push(
    `<div class='mb-2'><strong>Explanation:</strong> ${
      data.explanation || "N/A"
    }</div>`
  );

  // Raw toggle
  parts.push(
    `<details class='mt-2'><summary class='cursor-pointer text-xs text-gray-500'>Raw JSON</summary>` +
      `<pre class='p-2 bg-gray-50 dark:bg-gray-800 overflow-x-auto text-[10px]'>${escapeHtml(
        JSON.stringify(data, null, 2)
      )}</pre></details>`
  );

  return parts.join("");
}
```

## 5. New Frontend Module (`static/modules/kbRisk.js`)

Responsibilities:

- Provide `evaluateKbRisk(entityId)`.
- Optional: `evaluateChainRisk(chainJson)` for advanced manual testing.
- Provide `annotateGraph(entityId)`.

Functions:

- `fetchKbRules()` for potential future display of rule metadata.
- Internal helper for escaping HTML.

Error States:

- Network error → show inline message.
- Invalid chain JSON → highlight textarea border red, display parse error.

## 6. Visual Styling Guidelines

- Reuse existing card styling (rounded border, light/dark aware).
- Use compact tables for rule breakdown; align numeric columns right.
- Color cues:
  - Deterministic triggers: red text/icon.
  - Passed weighted rules: green check.
  - Failed weighted rules: muted dash.
- Feature heat strip (optional enhancement): create a flex container where each matched feature renders as:
  ```html
  <div
    class="inline-block px-2 py-0.5 rounded bg-indigo-600 text-white mr-1 mb-1"
    style="opacity: {weight/0.3+}"
    title="Weight: 0.25"
  >
    multi_accounts
  </div>
  ```

## 7. Integration Steps (Incremental)

1. Backend: Extend existing risk evaluation endpoint or create new `/risk/evaluate` endpoint returning extended details (add `weighted_details` for table data).
2. Frontend: Add the new KB card HTML skeleton to `index.html` beneath Risk Analysis.
3. Add `kbRisk.js` module and import it in `app.js`.
4. Wire button click to call `evaluateKbRisk(id)` using resolved root entity.
5. Implement annotate button using `/risk/annotate-graph`.
6. Smoke test with synthetic data triggering both deterministic and weighted rules.
7. Add small unit tests for new API response shape.

## 8. Accessibility & Explainability

- Include `<caption>` or `<h4>` with descriptive text for rule table.
- Use `aria-live="polite"` on result container to announce updates for screen readers.
- Provide `title` attributes for feature badges explaining underlying logic.

## 9. Performance Considerations (MVP)

- Response payloads small; no pagination needed.
- Avoid re-fetching rules on every evaluation (cache in module scope).
- Debounce chain textarea parsing until user clicks evaluate.

## 10. Future Enhancements

- Advanced filter (show only passed rules).
- Download report as JSON or PDF (client-side rendering).
- Inline editing of thresholds for quick experimentation (behind a flag).
- Graph overlay panel highlighting nodes influenced by KB scoring.

## 11. Minimal HTML Additions Snippet

```html
<div
  class="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm lg:col-span-2"
>
  <div
    class="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between"
  >
    <h3 class="text-base font-semibold">KB Risk Evaluation</h3>
    <div class="flex items-center gap-3">
      <button
        id="evaluateKbRisk"
        class="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        Evaluate KB Risk
      </button>
      <button
        id="annotateGraph"
        class="inline-flex items-center rounded-md bg-slate-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
      >
        Annotate Graph
      </button>
    </div>
  </div>
  <div
    id="kbRiskResults"
    class="p-4 text-sm text-gray-500 dark:text-gray-400"
    aria-live="polite"
  >
    Click Evaluate to run KB-based risk scoring.
  </div>
</div>
```

## 12. Acceptance Criteria (Display Layer)

- User can click "Evaluate KB Risk" and see score, labels, deterministic triggers (if any), weighted table, explanation.
- Raw JSON toggle works.
- Graph annotation call reports success and updates UI message.
- Works in dark and light mode without layout breakage.
- No console errors when evaluating or annotating.

---

This plan provides the actionable UX layer for the previously defined KB risk MVP, maintaining interpretability and low implementation friction.
