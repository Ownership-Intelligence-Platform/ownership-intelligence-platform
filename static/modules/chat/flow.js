// chat/flow.js
// Implements the main submit flow (entity resolution, fuzzy list, LLM call, supplementary scans)
import { tryResolveEntityInput } from "../utils.js";
import { externalLookup } from "../external.js";
import { fetchNameScan, renderNameScanCard, extractBirthdate } from "./scan.js";
import {
  hideCanonicalPanels,
  loadFullDashboardAndSnapshot,
  revealDashboard,
} from "./dashboard.js";
import {
  createConversationCard,
  appendMessage,
  createDashboardHintCard,
} from "./conversation.js";
import { triggerDashboardIntents, getDashboardMatches } from "./intents.js";
import {
  extractEntityIds,
  attachIdChipsBelowLastAssistant,
} from "./entitiesHelper.js";
import {
  chatState,
  pushHistory,
  setPendingExternal,
  consumePendingExternal,
} from "./state.js";

// Utility for toggling tall conversation card class
export function setLastConversationTall(isTall) {
  try {
    const lastCard = document.querySelector(
      "#chatTurnStream .chat-conversation-card:last-of-type"
    );
    if (!lastCard) return;
    lastCard.classList.toggle("chat-conversation-card--tall", !!isTall);
  } catch (_) {}
}

// Handle submission logic. Returns void.
export async function handleChatSubmit({
  text,
  sysEl,
  useWebEl,
  webProviderEl,
  hideSuggestions,
}) {
  const input = document.getElementById("chatInput");
  if (!text) return;

  const idPattern = /^(E\d+|P\d+)$/i;
  let showedFuzzyList = false;

  // Fuzzy list pre-display
  if (!idPattern.test(text)) {
    try {
      const res = await fetch(
        `/entities/suggest?q=${encodeURIComponent(text)}`
      );
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        if (items.length >= 2) {
          const chatSection = document.getElementById("chatSection");
          const msgsLayout = document.getElementById("chatMessages");
          if (chatSection && chatSection.classList.contains("centered")) {
            chatSection.classList.remove("centered");
            chatSection.classList.add("docked");
            msgsLayout?.classList.remove("hidden");
            document.body.classList.add("chat-docked");
          }
          revealDashboard();
          const convo = createConversationCard("对话");
          const targetList =
            convo?.messagesEl || document.getElementById("chatMessages");
          appendMessage("user", text, targetList);
          pushHistory("user", text);
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
            if (geo.primary_country)
              html += makeBadge("主要国家", geo.primary_country);
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
            li.innerHTML = `
              <div class=\"flex items-start justify-between mb-1\">
                <div class=\"flex items-center gap-2\">
                  <span class=\"font-bold text-slate-800 dark:text-slate-100 text-sm\">${name}</span>
                  <span class=\"px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700\">${
                    it.id
                  }</span>
                </div>
                <div class=\"flex items-center gap-2\">
                  <span class=\"text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800\">${type}</span>
                </div>
              </div>
              <div class=\"text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-1\">${
                it.description || ""
              }</div>`;
            li.addEventListener("click", async () => {
              try {
                const entityId = await tryResolveEntityInput(it.id);
                if (!entityId) {
                  appendMessage(
                    "assistant",
                    `未能加载实体: ${it.id}`,
                    targetList
                  );
                  return;
                }
                const root = document.getElementById("rootId");
                if (root) root.value = entityId;
                const initRoot = document.getElementById("initialRootId");
                if (initRoot) initRoot.value = entityId;
                revealDashboard();
                await loadFullDashboardAndSnapshot(
                  entityId,
                  name,
                  "Dashboard 快照"
                );
                appendMessage(
                  "assistant",
                  `已选择并加载实体: [${entityId}]`,
                  targetList
                );
                pushHistory("assistant", `已选择并加载实体: [${entityId}]`);
                setLastConversationTall(false);
              } catch (err) {
                appendMessage("assistant", `加载实体出错: ${err}`, targetList);
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
            targetList.parentElement.scrollTop =
              targetList.parentElement.scrollHeight;
          showedFuzzyList = true;
          return; // stop normal flow until selection
        }
      }
    } catch (_) {}
  }

  // Layout activation
  const chatSection = document.getElementById("chatSection");
  const msgs = document.getElementById("chatMessages");
  if (chatSection && chatSection.classList.contains("centered")) {
    chatSection.classList.remove("centered");
    chatSection.classList.add("docked");
    msgs?.classList.remove("hidden");
    document.body.classList.add("chat-docked");
  }

  revealDashboard();
  const convo = createConversationCard("对话");
  if (showedFuzzyList) setLastConversationTall(true);
  const targetList =
    convo?.messagesEl || document.getElementById("chatMessages");

  appendMessage("user", text, targetList);
  pushHistory("user", text);
  if (input) input.value = "";

  triggerDashboardIntents(text);

  // pending external extra details path
  const pending = chatState.pendingExternal;
  if (pending && pending.name) {
    try {
      const bd = extractBirthdate(text);
      const isSkip = /^(跳过|不用|skip|no)$/i.test(text);
      appendMessage(
        "assistant",
        bd
          ? `收到，出生日期为 ${bd}。开始从公开来源检索…`
          : isSkip
          ? "好的，跳过出生日期。开始从公开来源检索…"
          : "收到补充信息。开始从公开来源检索…",
        targetList
      );
      await externalLookup(pending.name, bd || "");
    } catch (err) {
      appendMessage("assistant", `外部检索出错：${err}`, targetList);
    } finally {
      consumePendingExternal();
    }
    return;
  }

  // Quoted candidate fast-path
  const m = text.match(/["“”'‘’]([^"“”'‘’]+)["“”'‘’]/);
  const candidate = m ? m[1].trim() : null;
  if (candidate) {
    try {
      const entityId = await tryResolveEntityInput(candidate);
      if (entityId) {
        const root = document.getElementById("rootId");
        if (root) root.value = entityId;
        const initRoot = document.getElementById("initialRootId");
        if (initRoot) initRoot.value = entityId;
        revealDashboard();
        await loadFullDashboardAndSnapshot(
          entityId,
          candidate,
          "Dashboard 快照"
        );
        appendMessage(
          "assistant",
          `Found internal entity and loaded its details: [${entityId}].`,
          targetList
        );
        pushHistory(
          "assistant",
          `Found internal entity and loaded its details: [${entityId}].`
        );
        return;
      }
    } catch (_) {}
  }

  // Whole input resolution attempt
  try {
    const entityId2 = await tryResolveEntityInput(text);
    if (entityId2) {
      const root = document.getElementById("rootId");
      if (root) root.value = entityId2;
      const initRoot = document.getElementById("initialRootId");
      if (initRoot) initRoot.value = entityId2;
      revealDashboard();
      await loadFullDashboardAndSnapshot(entityId2, text, "Dashboard 快照");
      appendMessage(
        "assistant",
        `Found internal entity and loaded its details: [${entityId2}].`,
        targetList
      );
      pushHistory(
        "assistant",
        `Found internal entity and loaded its details: [${entityId2}].`
      );
      return;
    }
  } catch (_) {}

  // LLM path
  appendMessage("assistant", "…", targetList);
  try {
    const body = {
      message: text,
      history: chatState.history,
      system_prompt: sysEl ? sysEl.value.trim() || undefined : undefined,
      use_web: !!(useWebEl && useWebEl.checked),
      web_provider: webProviderEl ? webProviderEl.value : undefined,
      use_person_resolver: true,
    };
    const resp = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const list = targetList || document.getElementById("chatMessages");
    const last = list?.lastElementChild;
    const reply = data.reply || "";
    if (last) last.textContent = reply;
    else appendMessage("assistant", reply, list);
    pushHistory("assistant", reply);

    if (
      data.person_resolver &&
      Array.isArray(data.person_resolver.candidates)
    ) {
      try {
        renderPersonResolverCard(
          candidate || text,
          data.person_resolver.candidates,
          list
        );
      } catch (e) {
        console.error("Failed to render person resolver card", e);
      }
    }

    const matches = getDashboardMatches(reply);
    if (matches.length) {
      createDashboardHintCard(matches);
      triggerDashboardIntents(reply);
    }

    const ids = extractEntityIds(reply);
    if (ids.length) {
      attachIdChipsBelowLastAssistant(ids, list);
      const first = ids[0];
      const root = document.getElementById("rootId");
      if (root) root.value = first;
      revealDashboard();
      await loadFullDashboardAndSnapshot(first, first, "Dashboard 快照");
    }

    if (Array.isArray(data.sources) && data.sources.length) {
      const container = document.createElement("div");
      container.className =
        "px-3 py-2 rounded mb-2 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100";
      const listEl = document.createElement("ul");
      for (const s of data.sources) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = s.url;
        a.textContent = s.title || s.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        li.appendChild(a);
        listEl.appendChild(li);
      }
      const heading = document.createElement("div");
      heading.className = "font-medium mb-1";
      heading.textContent = "Sources:";
      container.appendChild(heading);
      container.appendChild(listEl);
      const msgs = targetList || document.getElementById("chatMessages");
      msgs?.appendChild(container);
    }
  } catch (err) {
    const list = targetList || document.getElementById("chatMessages");
    const last = list?.lastElementChild;
    const msg = `Error: ${err}`;
    if (last) last.textContent = msg;
    else appendMessage("assistant", msg, list);
  }

  // Supplementary name scan
  const nameForScan = candidate || text;
  try {
    const scan = await fetchNameScan(nameForScan);
    renderNameScanCard(nameForScan, scan);
  } catch (_) {}

  setPendingExternal({ name: nameForScan, askedAt: Date.now() });
  appendMessage(
    "assistant",
    "已完成基础姓名扫描（相似客户与本地名单命中已在下方卡片展示）。\n如需进一步从公开来源检索，可补充以下信息（也可以回复“跳过”）：\n- 出生日期（例如 1990-01-02）\n- 可能的户籍/地区\n- 常用别名或相关公司名称",
    targetList
  );
}

// Compact person resolver card retained from original implementation
function renderPersonResolverCard(name, candidates, targetList) {
  if (!candidates || !candidates.length) return;
  const list =
    targetList || document.getElementById("chatMessages") || document.body;
  const card = document.createElement("div");
  card.className =
    "mt-2 mb-1 border border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-900/20 dark:border-emerald-500/50 rounded-xl text-xs sm:text-sm text-emerald-900 dark:text-emerald-50 px-3 py-2 shadow-sm max-w-2xl";
  const title = document.createElement("div");
  title.className = "font-semibold flex items-center gap-1 mb-1";
  title.innerHTML =
    '<span class="inline-flex w-4 h-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">图</span>' +
    `<span>基于图谱的匹配候选（${name || "查询"}）</span>`;
  card.appendChild(title);
  const listEl = document.createElement("ul");
  listEl.className = "space-y-0.5";
  candidates.slice(0, 5).forEach((c) => {
    const li = document.createElement("li");
    li.className =
      "flex items-start justify-between gap-2 border-t border-emerald-100/60 dark:border-emerald-700/60 first:border-t-0 pt-1 first:pt-0 mt-1 first:mt-0";
    const left = document.createElement("div");
    left.className = "flex-1 min-w-0";
    const nameSpan = document.createElement("div");
    nameSpan.className = "font-medium truncate";
    const label = c.name || c.node_id || "(未命名)";
    nameSpan.textContent = label;
    left.appendChild(nameSpan);
    const meta = document.createElement("div");
    meta.className = "text-[11px] text-emerald-700 dark:text-emerald-200/80";
    const score =
      typeof c.score === "number" ? `score=${c.score.toFixed(3)}` : "score=?";
    const idText = c.node_id ? `[${c.node_id}]` : "";
    meta.textContent = `${idText} ${score}`.trim();
    left.appendChild(meta);
    if (c.evidence) {
      const ev = document.createElement("div");
      ev.className =
        "text-[11px] text-emerald-800/80 dark:text-emerald-100/80 line-clamp-2";
      ev.textContent = c.evidence;
      left.appendChild(ev);
    }
    li.appendChild(left);
    if (c.node_id && /^P\d+$/i.test(c.node_id)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2.5 py-1 text-[11px] hover:bg-emerald-500 shadow-sm";
      btn.innerHTML =
        '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h10M7 12h4m1 4h5m-8 0a4 4 0 11-8 0 4 4 0 018 0zm10-4a4 4 0 11-8 0 4 4 0 018 0zm-10-8a4 4 0 11-8 0 4 4 0 018 0z"/></svg>' +
        "<span>人物网络</span>";
      btn.addEventListener("click", () => {
        const url = `/static/person_network.html?person=${encodeURIComponent(
          c.node_id
        )}`;
        window.open(url, "_blank");
      });
      li.appendChild(btn);
    }
    listEl.appendChild(li);
  });
  card.appendChild(listEl);
  list.appendChild(card);
}
