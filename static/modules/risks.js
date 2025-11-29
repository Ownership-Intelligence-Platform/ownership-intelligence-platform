// Risk analysis module: fetches /entities/{id}/risks and renders results.

function formatFlags(item) {
  const flags = item.risk_flags || [];
  if (!flags.length) return "";
  return ` ⚠️ ${flags.join("; ")} (score=${item.risk_score?.toFixed(2)})`;
}

function renderSection(title, section, itemFormatter) {
  if (!section)
    return `<div class="mb-4"><h4 class="font-semibold">${title}</h4><div class="text-gray-400">No data</div></div>`;
  const { items = [], risky = [], risky_count = 0 } = section;
  const riskyBadge =
    risky_count > 0
      ? `<span class="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-rose-600 text-white">${risky_count} risky</span>`
      : "";
  const list =
    items
      .map(
        (it) =>
          `<li class="border-b border-gray-200 dark:border-gray-800 py-1">${itemFormatter(
            it
          )}${formatFlags(it)}</li>`
      )
      .join("") || `<li class="py-1 text-gray-400">None</li>`;
  return `<div class="mb-4"><h4 class="font-semibold">${title}${riskyBadge}</h4><ul class="mt-1">${list}</ul></div>`;
}

export async function analyzeRisks(entityId, newsLimit = 5) {
  const el = document.getElementById("riskResults");
  el.textContent = "Analyzing risks...";
  try {
    const res = await fetch(
      `/entities/${encodeURIComponent(
        entityId
      )}/risk-summary?news_limit=${newsLimit}`
    );
    if (!res.ok) {
      el.textContent = `Risk analysis failed: ${res.status}`;
      return;
    }
    const data = await res.json();
    // Prefer LLM summary text if present
    if (data.summary_text) {
      let meta = ``;
      if (data.model)
        meta += `<div class="text-xs text-gray-400">模型: ${data.model}</div>`;
      if (data.source)
        meta += `<div class="text-xs text-gray-400">来源: ${data.source}</div>`;
      el.innerHTML = `<div class="mb-2">${meta}</div><div class="whitespace-pre-wrap">${data.summary_text}</div>`;
      return;
    }
    // If no summary_text, fall back to previous full analysis rendering if provided
    const parts = [];
    parts.push(
      `<div class="mb-4"><strong>Entity:</strong> ${data.entity?.id} ${
        data.entity?.name || ""
      }</div>`
    );
    if (data.summary) {
      parts.push(
        `<div class="mb-4"><strong>Summary:</strong> Total Items: ${
          data.summary.total_items
        }, Total Risky: ${
          data.summary.total_risky_items
        }, Overall Score: ${data.summary.overall_risk_score.toFixed(2)}</div>`
      );
    }
    parts.push(
      renderSection(
        "Accounts",
        data.accounts || {},
        (a) =>
          `${a.account_number || "?"} (${a.bank_name || "?"}) bal=${
            a.balance ?? "n/a"
          }`
      )
    );
    parts.push(
      renderSection(
        "Transactions",
        data.transactions || {},
        (t) =>
          `${t.from_id || "?"} → ${t.to_id || "?"} amt=${t.amount || "n/a"}`
      )
    );
    parts.push(
      renderSection(
        "Guarantees",
        data.guarantees || {},
        (g) =>
          `${g.guarantor_id || "?"} ⇄ ${g.guaranteed_id || "?"} amt=${
            g.amount || "n/a"
          }`
      )
    );
    parts.push(
      renderSection(
        "Supply Chain",
        data.supply_chain || {},
        (s) =>
          `${s.supplier_id || "?"} → ${s.customer_id || "?"} freq=${
            s.frequency ?? ""
          }`
      )
    );
    parts.push(
      renderSection(
        "News",
        data.news || {},
        (n) => `${n.title || n.url || "n/a"}`
      )
    );

    el.innerHTML = parts.join("");
  } catch (err) {
    console.error(err);
    el.textContent = `Risk analysis error: ${err}`;
  }
}

// Expose for debug
window.OI = window.OI || {};
window.OI.analyzeRisks = analyzeRisks;
