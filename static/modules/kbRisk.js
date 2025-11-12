// KB Risk evaluation UI module with feature heat strip rendering
// Endpoints: POST /risk/evaluate, POST /risk/annotate-graph, GET /kb/rules

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderKbRisk(data) {
  if (!data) return "<div class='text-red-600'>No data</div>";
  const parts = [];
  parts.push(
    `<div class='text-sm mb-2'>` +
      `<strong>Score:</strong> ${data.score ?? "-"} ` +
      `| <strong>Labels:</strong> ${
        (data.labels || []).join(", ") || "None"
      } ` +
      `| <strong>Deterministic:</strong> ${
        (data.deterministic_triggers || []).join(", ") || "None"
      }` +
      `</div>`
  );

  if (data.deterministic_triggers && data.deterministic_triggers.length) {
    parts.push(
      `<div class='mb-3'><h4 class='font-semibold'>Deterministic Triggers</h4>` +
        `<ul class='ml-4 list-disc'>` +
        data.deterministic_triggers
          .map((r) => `<li class='text-rose-600'>${escapeHtml(r)}</li>`)
          .join("") +
        `</ul></div>`
    );
  }

  if (data.weighted_details && data.weighted_details.length) {
    parts.push(
      `<table class='w-full text-xs border mb-3'>` +
        `<thead><tr class='bg-gray-100 dark:bg-gray-800'>` +
        `<th class='p-1 text-left'>Rule</th>` +
        `<th class='p-1 text-left'>Category</th>` +
        `<th class='p-1'>Matched Features</th>` +
        `<th class='p-1'>Score</th>` +
        `<th class='p-1'>Threshold</th>` +
        `<th class='p-1'>Passed</th>` +
        `</tr></thead><tbody>` +
        data.weighted_details
          .map(
            (w) =>
              `<tr>` +
              `<td class='p-1'>${escapeHtml(w.id || "")}</td>` +
              `<td class='p-1'>${escapeHtml(w.category || "")}</td>` +
              `<td class='p-1'>${escapeHtml(
                (w.matched_features || []).join(", ") || "-"
              )}</td>` +
              `<td class='p-1' style='text-align:right'>${
                (w.raw_score ?? 0).toFixed
                  ? w.raw_score.toFixed(2)
                  : w.raw_score
              }</td>` +
              `<td class='p-1' style='text-align:right'>${escapeHtml(
                String(w.threshold ?? "-")
              )}</td>` +
              `<td class='p-1'>${w.passed ? "✅" : "—"}</td>` +
              `</tr>`
          )
          .join("") +
        `</tbody></table>`
    );

    // Feature heat strip across all rules (union of feature weights)
    const heat = new Map(); // name -> max weight
    for (const det of data.weighted_details) {
      const fws = det.feature_weights || [];
      for (const fw of fws) {
        const cur = heat.get(fw.name) || 0;
        if (fw.weight > cur) heat.set(fw.name, fw.weight);
      }
    }
    if (heat.size) {
      parts.push(
        `<div class='mb-2'><h4 class='font-semibold text-sm'>Matched Features</h4>`
      );
      parts.push(`<div class='mt-1'>`);
      for (const [name, weight] of heat.entries()) {
        const opacity = Math.min(1, (weight || 0) / 0.3);
        parts.push(
          `<span class='inline-block px-2 py-0.5 rounded bg-indigo-600 text-white mr-1 mb-1' style='opacity:${opacity.toFixed(
            2
          )}' title='Weight: ${weight}'>${escapeHtml(name)}</span>`
        );
      }
      parts.push(`</div></div>`);
    }
  }

  parts.push(
    `<div class='mb-2'><strong>Explanation:</strong> ${escapeHtml(
      data.explanation || "N/A"
    )}</div>`
  );

  parts.push(
    `<details class='mt-2'><summary class='cursor-pointer text-xs text-gray-500'>Raw JSON</summary>` +
      `<pre class='p-2 bg-gray-50 dark:bg-gray-800 overflow-x-auto text-[10px]'>${escapeHtml(
        JSON.stringify(data, null, 2)
      )}</pre>` +
      `</details>`
  );

  return parts.join("");
}

export async function evaluateKbRisk(entityId, body = null) {
  const el = document.getElementById("kbRiskResults");
  if (!el) return;
  el.textContent = "Evaluating KB risk...";
  try {
    const payload = body || { entity_id: entityId };
    const res = await fetch("/risk/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg =
        res.status === 404
          ? "Endpoint not implemented yet"
          : `HTTP ${res.status}`;
      el.innerHTML = `<div class='text-amber-600'>KB risk evaluation unavailable: ${msg}</div>`;
      return;
    }
    const data = await res.json();
    el.innerHTML = renderKbRisk(data);
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class='text-red-600'>KB risk evaluation error: ${escapeHtml(
      String(err)
    )}</div>`;
  }
}

export async function annotateGraph(entityId) {
  const el = document.getElementById("kbRiskResults");
  try {
    const res = await fetch("/risk/annotate-graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_ids: [entityId] }),
    });
    if (!res.ok) {
      const msg =
        res.status === 404
          ? "Endpoint not implemented yet"
          : `HTTP ${res.status}`;
      el &&
        (el.innerHTML += `<div class='mt-2 text-amber-600'>Annotate graph unavailable: ${msg}</div>`);
      return;
    }
    const data = await res.json();
    el &&
      (el.innerHTML += `<div class='mt-2 text-emerald-600'>Graph annotation done: ${
        data.updated || 0
      } node(s) updated</div>`);
  } catch (err) {
    console.error(err);
    el &&
      (el.innerHTML += `<div class='mt-2 text-red-600'>Annotate error: ${escapeHtml(
        String(err)
      )}</div>`);
  }
}

// Open graph view for the current entity: prefer in-page penetration graph; fallback to person network page
export function openGraphView(entityId) {
  try {
    // If global helpers exist, set root and render penetration graph on the current page
    const rootInput = document.getElementById("rootId");
    if (rootInput) rootInput.value = entityId;
    if (window.OI && typeof window.OI.loadPenetration === "function") {
      // Try to render locally and scroll into view
      window.OI.loadPenetration();
      const section = document.getElementById("penetrationChart");
      if (section && section.scrollIntoView)
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      const el = document.getElementById("kbRiskResults");
      el &&
        (el.innerHTML += `<div class='mt-2 text-gray-600 dark:text-gray-300'>Opened penetration graph for ${escapeHtml(
          entityId
        )} below.</div>`);
      return;
    }
  } catch (_) {}
  // Fallback: open person network page in new tab (works best for person IDs)
  const url = `/static/person_network.html?person=${encodeURIComponent(
    entityId
  )}`;
  window.open(url, "_blank");
}

// Expose for manual testing
window.OI = window.OI || {};
window.OI.evaluateKbRisk = evaluateKbRisk;
window.OI.annotateGraph = annotateGraph;
window.OI.openGraphView = openGraphView;
