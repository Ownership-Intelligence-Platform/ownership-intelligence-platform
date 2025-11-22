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
  const desc = escapeHtml(ent.description || "No description available.");
  // Extended blocks (Person only)
  const ext = ent.extended || {};
  const kyc = ext.kyc_info || null;
  const risk = ext.risk_profile || null;
  const network = ext.network_info || null;
  const geo = ext.geo_profile || null;

  function renderDict(title, obj, opts = {}) {
    if (!obj || !Object.keys(obj).length) return "";
    const entries = Object.entries(obj)
      .filter(([_, v]) => v !== null && v !== undefined && v !== "")
      .slice(0, opts.max || 14)
      .map(([k, v]) => {
        let val;
        if (Array.isArray(v)) val = v.join(", ");
        else if (typeof v === "object") val = JSON.stringify(v);
        else val = String(v);
        return `<div class=\"flex justify-between gap-2\"><span class=\"text-gray-500 dark:text-gray-400\">${escapeHtml(
          k
        )}</span><span class=\"text-gray-700 dark:text-gray-200 font-medium\">${escapeHtml(
          val
        )}</span></div>`;
      })
      .join("");
    return `<div class=\"mt-3\"><div class=\"text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1\">${escapeHtml(
      title
    )}</div><div class=\"space-y-1 text-xs\">${entries}</div></div>`;
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
      <div class="text-sm text-gray-600 dark:text-gray-300">ID: <code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">${id}</code></div>
      <div class="text-base font-semibold flex items-center flex-wrap gap-1">${name}${
    type
      ? ` <span class=\"text-xs font-normal text-gray-500 dark:text-gray-400\">(${type})</span>`
      : ""
  } ${summaryChips}</div>
      <div class="mt-2">
        <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Description</div>
        <div class="whitespace-pre-wrap text-gray-700 dark:text-gray-200">${desc}</div>
      </div>
      ${renderDict("KYC 信息", kyc, { max: 10 })}
      ${renderDict("风险画像", risk, { max: 10 })}
      ${renderDict("社交/网络", network, { max: 10 })}
      ${renderDict("地理画像", geo, { max: 8 })}
    </div>
  `;
}
