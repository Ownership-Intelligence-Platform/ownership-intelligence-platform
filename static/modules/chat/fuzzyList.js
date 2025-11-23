// chat/fuzzyList.js
// Renders fuzzy entity match card if multiple suggestion candidates found before main flow.
// Returns true if handled (card rendered and normal submit flow should stop), else false.
import { tryResolveEntityInput } from "../utils.js";
import { revealDashboard, loadFullDashboardAndSnapshot } from "./dashboard.js";
import { createConversationCard, appendMessage } from "./conversation.js";
import { pushHistory } from "./state.js";
import { setLastConversationTall } from "./flow.js"; // relies on exported helper

export async function maybeRenderFuzzyList(text) {
  const idPattern = /^(E\d+|P\d+)$/i;
  if (idPattern.test(text)) return false;
  let res;
  try {
    res = await fetch(`/entities/suggest?q=${encodeURIComponent(text)}`);
  } catch (_) {
    return false;
  }
  if (!res || !res.ok) return false;
  const data = await res.json();
  const items = data.items || [];
  if (items.length < 2) return false;

  // Dock layout if needed
  const chatSection = document.getElementById("chatSection");
  const msgsLayout = document.getElementById("chatMessages");
  if (chatSection && chatSection.classList.contains("centered")) {
    chatSection.classList.remove("centered");
    chatSection.classList.add("docked");
    msgsLayout?.classList.remove("hidden");
    document.body.classList.add("chat-docked");
  }
  const convo = createConversationCard("对话");
  const targetList =
    convo?.messagesEl || document.getElementById("chatMessages");
  appendMessage("user", text, targetList);
  pushHistory("user", text);
  const input = document.getElementById("chatInput");
  if (input) input.value = "";

  // Build fuzzy card
  const wrap = document.createElement("div");
  wrap.className =
    "rounded-xl mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col w-full";
  const heading = document.createElement("div");
  heading.className =
    "px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2 sticky top-0 z-10 backdrop-blur-sm shrink-0";
  heading.innerHTML = `<svg class=\"w-4 h-4 text-indigo-500\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z\"></path></svg> 可能匹配的实体 (${items.length})`;
  wrap.appendChild(heading);
  const listEl = document.createElement("ul");
  listEl.className =
    "divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto custom-scrollbar";

  function makeBadge(
    label,
    value,
    colorClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
  ) {
    if (value == null) return "";
    return `<span class=\"inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${colorClass} mr-2 mb-1 border border-slate-200 dark:border-slate-700/50\"><span class=\"opacity-70 mr-1\">${label}:</span> ${value}</span>`;
  }

  function renderInlineDetails(li, it) {
    if (li.querySelector(".entity-inline")) return;
    const box = document.createElement("div");
    box.className =
      "entity-inline mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50 flex flex-wrap gap-y-1";
    const basic = it.basic_info || {};
    const kyc = it.kyc_info || {};
    const risk = it.risk_profile || {};
    const network = it.network_info || {};
    const geo = it.geo_profile || {};
    let html = "";
    if (kyc.kyc_risk_level) {
      const color =
        kyc.kyc_risk_level === "high"
          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800"
          : kyc.kyc_risk_level === "medium"
          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
      html += makeBadge("风险", kyc.kyc_risk_level, color);
    }
    if (basic.birth_date) html += makeBadge("出生", basic.birth_date);
    if (basic.nationality) html += makeBadge("国籍", basic.nationality);
    if (kyc.kyc_status) html += makeBadge("KYC", kyc.kyc_status);
    if (kyc.pep_status && kyc.pep_status !== "none")
      html += makeBadge(
        "PEP",
        kyc.pep_status,
        "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
      );
    if (risk.composite_risk_score != null)
      html += makeBadge("综合分", risk.composite_risk_score);
    if (network.relationship_density_score != null)
      html += makeBadge("关系密度", network.relationship_density_score);
    if (geo.primary_country) html += makeBadge("主要国家", geo.primary_country);
    if (!html && it.description)
      html = `<span class=\"text-slate-500 dark:text-slate-400 italic text-[10px]\">${it.description}</span>`;
    else if (!html)
      html = `<span class=\"text-slate-400 dark:text-slate-500 text-[10px]\">无详细信息</span>`;
    box.innerHTML = html;
    li.appendChild(box);
  }

  items.slice(0, 20).forEach((it) => {
    const li = document.createElement("li");
    li.className =
      "group p-4 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 cursor-pointer transition-all duration-200 border-l-4 border-transparent hover:border-indigo-500 dark:hover:border-indigo-400";
    const name = (it.name || it.id || "").trim();
    const type = it.type || "Entity";
    li.innerHTML = `\n      <div class=\"flex items-start justify-between mb-1\">\n        <div class=\"flex items-center gap-2\">\n          <span class=\"font-bold text-slate-800 dark:text-slate-100 text-sm\">${name}</span>\n          <span class=\"px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700\">${
      it.id
    }</span>\n        </div>\n        <div class=\"flex items-center gap-2\">\n          <span class=\"text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800\">${type}</span>\n        </div>\n      </div>\n      <div class=\"text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-1\">${
      it.description || ""
    }</div>`;
    li.addEventListener("click", async () => {
      try {
        const entityId = await tryResolveEntityInput(it.id);
        if (!entityId) {
          appendMessage("assistant", `未能加载实体: ${it.id}`);
          return;
        }
        const root = document.getElementById("rootId");
        if (root) root.value = entityId;
        const initRoot = document.getElementById("initialRootId");
        if (initRoot) initRoot.value = entityId;
        revealDashboard();
        await loadFullDashboardAndSnapshot(entityId, name, "Dashboard 快照");
        appendMessage("assistant", `已选择并加载实体: [${entityId}]`);
        pushHistory("assistant", `已选择并加载实体: [${entityId}]`);
        setLastConversationTall(false);
      } catch (err) {
        appendMessage("assistant", `加载实体出错: ${err}`);
      }
    });
    renderInlineDetails(li, it);
    listEl.appendChild(li);
  });
  if (items.length > 20) {
    const more = document.createElement("li");
    more.className =
      "py-2 px-4 text-xs text-slate-400 text-center bg-slate-50 dark:bg-slate-800/30";
    more.textContent = `其余 ${
      items.length - 20
    } 条已省略，请优化关键字以缩小范围。`;
    listEl.appendChild(more);
  }
  wrap.appendChild(listEl);
  targetList.appendChild(wrap);
  setLastConversationTall(true);
  if (targetList.parentElement)
    targetList.parentElement.scrollTop = targetList.parentElement.scrollHeight;
  return true;
}
