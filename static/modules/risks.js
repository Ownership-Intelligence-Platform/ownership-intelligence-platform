// Risk analysis module: fetches /entities/{id}/risks and renders results.

function formatFlags(item) {
  const flags = item.risk_flags || [];
  if (!flags.length) return "";
  return ` ⚠️ ${flags.join("; ")} (score=${item.risk_score?.toFixed(2)})`;
}

function escapeHtml(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    // Prefer LLM summary if present; server may also return sanitized HTML + analysis for evidence links
    if (data.summary_text) {
      let meta = ``;
      if (data.model)
        meta += `<div class="text-xs text-gray-400">模型: ${data.model}</div>`;
      if (data.source)
        meta += `<div class="text-xs text-gray-400">来源: ${data.source}</div>`;

      // Use server-rendered HTML when available (already sanitized server-side)
      const summaryHtml =
        data.summary_html ||
        `<div class="whitespace-pre-wrap">${escapeHtml(
          data.summary_text
        )}</div>`;

      // Build evidence links from analysis (accounts, transactions, guarantees, supply_chain, news)
      let evidenceHtml = "";
      const ana = data.analysis || data; // fallback if analysis included at top-level
      const entId = (ana && ana.entity && ana.entity.id) || entityId;
      if (ana) {
        const sections = [
          {
            key: "accounts",
            label: "Accounts",
            url: `/entities/${encodeURIComponent(entId)}/accounts`,
          },
          {
            key: "transactions",
            label: "Transactions",
            url: `/entities/${encodeURIComponent(entId)}/transactions`,
          },
          {
            key: "guarantees",
            label: "Guarantees",
            url: `/entities/${encodeURIComponent(entId)}/guarantees`,
          },
          {
            key: "supply_chain",
            label: "Supply Chain",
            url: `/entities/${encodeURIComponent(entId)}/supply-chain`,
          },
          { key: "news", label: "News", url: null },
        ];
        const itemsList = [];
        sections.forEach((s) => {
          const sec = ana[s.key];
          const risky = sec && sec.risky ? sec.risky.slice(0, 3) : [];
          if (risky && risky.length) {
            const inner = risky
              .map((it) => {
                if (s.key === "news") {
                  const href = it.url || it.source || "#";
                  return `<a class="text-rose-600 underline" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                    it.title || it.url || href
                  )}</a>`;
                }
                // internal resources link to the subresource list for the entity
                const label =
                  (it.account_number && `${it.account_number}`) ||
                  (it.from_id && `${it.from_id} → ${it.to_id}`) ||
                  (it.guarantor_id &&
                    `${it.guarantor_id} ⇄ ${it.guaranteed_id}`) ||
                  (it.supplier_id && `${it.supplier_id} → ${it.customer_id}`) ||
                  JSON.stringify(it);
                return `<a class="text-sky-600 underline" href="${
                  s.url
                }" target="_self">${escapeHtml(s.label + ": " + label)}</a>`;
              })
              .join("<br>");
            itemsList.push(
              `<li class="py-1"><strong>${escapeHtml(
                s.label
              )}:</strong> ${inner}</li>`
            );
          }
        });
        if (itemsList.length) {
          evidenceHtml = `<div class="mb-4"><h4 class="font-semibold">关键风险要点与证据</h4><ul class="mt-1">${itemsList.join(
            ""
          )}</ul></div>`;
        }
      }

      el.innerHTML = `<div class="mb-2">${meta}</div>${summaryHtml}${evidenceHtml}`;
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
