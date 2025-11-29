// Entity module: fetch and render basic entity info including description
export async function loadEntityInfo(entityId) {
  const panel = document.getElementById("entityInfo");
  if (!panel) return;
  panel.textContent = "Loading entity info…";
  try {
    const res = await fetch(`/entities/${encodeURIComponent(entityId)}`);
    if (!res.ok) {
      panel.textContent = `Failed to load entity info (${res.status})`;
      return;
    }
    const ent = await res.json();
    panel.innerHTML = renderEntity(ent);
  } catch (e) {
    panel.textContent = `Error: ${e}`;
  }
}

function escapeHtml(s) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderEntity(ent) {
  const id = escapeHtml(ent.id);
  const name = escapeHtml(ent.name || "(unnamed)");
  const type = escapeHtml(ent.type || "");
  const desc = escapeHtml(ent.description || "无可用描述。");
  // Extended blocks (Person only)
  const ext = ent.extended || {};
  const kyc = ext.kyc_info || null;
  const risk = ext.risk_profile || null;
  const network = ext.network_info || null;
  const geo = ext.geo_profile || null;

  function renderDict(title, obj, opts = {}) {
    if (!obj || !Object.keys(obj).length) return "";
    // Map common keys to Chinese labels for friendlier display
    const keyLabelMap = {
      kyc_status: "KYC 状态",
      pep_status: "PEP 状态",
      source_of_funds_declared: "资金来源",
      onboarding_date: "开户日期",
      watchlist_hits: "名单命中数",
      sanction_screen_hits: "制裁命中数",
      kyc_risk_level: "KYC 风险级别",
      negative_news_count: "负面新闻数",
      composite_risk_score: "综合分",
      risk_factors: "风险因素",
      relationship_density_score: "关系密度得分",
      known_associates: "已知关联方",
      offshore_exposure: "离岸运营暴露",
      primary_country: "主要国家",
      countries_recent_6m: "近6月出现国家",
    };
    const entries = Object.entries(obj)
      .filter(([_, v]) => v !== null && v !== undefined && v !== "")
      .slice(0, opts.max || 14)
      .map(([k, v]) => {
        let val;
        if (Array.isArray(v)) val = v.join(", ");
        else if (typeof v === "object") val = JSON.stringify(v);
        else val = String(v);
        const label = keyLabelMap[k] || k;
        return `<div class=\"flex justify-between gap-2\"><span class=\"text-sm text-gray-500 dark:text-gray-400\">${escapeHtml(
          label
        )}</span><span class=\"text-sm text-gray-700 dark:text-gray-200 font-medium underline\">${escapeHtml(
          val
        )}</span></div>`;
      })
      .join("");
    return `<div class=\"mt-3\"><div class=\"text-sm text-gray-500 dark:text-gray-400 mb-1\">${escapeHtml(
      title
    )}</div><div class=\"space-y-1 text-sm\">${entries}</div></div>`;
  }

  // Highlight summary chips
  let summaryChips = "";
  if (kyc) {
    const status = escapeHtml(kyc.kyc_status || "?");
    const level = escapeHtml(kyc.kyc_risk_level || "-");
    summaryChips += `<span class=\"inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100 text-[11px] mr-1\">KYC:${status}</span>`;
    summaryChips += `<span class=\"inline-flex items-center px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-100 text-[11px] mr-1\">风险:${level}</span>`;
  }
  if (risk && risk.composite_risk_score != null) {
    summaryChips += `<span class=\"inline-flex items-center px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-800 text-rose-800 dark:text-rose-100 text-[11px] mr-1\">综合分:${escapeHtml(
      String(risk.composite_risk_score)
    )}</span>`;
  }

  return `
    <div class="space-y-2">
      <div class="text-sm text-gray-600 dark:text-gray-300">实体ID： <code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">${id}</code></div>
      <div class="text-base font-semibold flex items-center flex-wrap gap-1">${name}${
    type
      ? ` <span class=\"text-sm font-normal text-gray-500 dark:text-gray-400\">(${type})</span>`
      : ""
  } ${summaryChips}</div>
      <div class="mt-2">
        <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">描述</div>
        <div class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200 underline">${desc}</div>
      </div>
      ${renderDict("KYC 信息", kyc, { max: 10 })}
      ${renderDict("风险画像", risk, { max: 10 })}
      ${renderDict("社交/网络", network, { max: 10 })}
      ${renderDict("地理画像", geo, { max: 8 })}
    </div>
  `;
}
