// Simple chat widget logic for the AI Assistant panel
// Enhancements: detect quoted entity names in messages to resolve against
// internal data first; if found, load the Entity Info card and show a
// lightweight confirmation reply without invoking the LLM. Otherwise,
// maintain in-memory history and call backend /chat endpoint.

// Refactored chat module: orchestrates chat UI, importing specialized helpers.
// Split responsibilities into per-topic modules under ./chat/*.js:
// - scan.js: name scan fetching + birthdate extraction
// - dashboard.js: dashboard loading + snapshot creation
// - conversation.js: conversation card + message rendering
// - intents.js: dashboard intent detection/matching
// - entitiesHelper.js: entity id extraction + chip actions
// This file now focuses on wiring the form events and high-level flow.

import { tryResolveEntityInput } from "./utils.js";
import { externalLookup } from "./external.js";
import {
  fetchNameScan,
  renderNameScanCard,
  extractBirthdate,
} from "./chat/scan.js";
import {
  hideCanonicalPanels,
  loadFullDashboardAndSnapshot,
  revealDashboard,
} from "./chat/dashboard.js";
import {
  createConversationCard,
  appendMessage,
  createDashboardHintCard,
} from "./chat/conversation.js";
import {
  triggerDashboardIntents,
  getDashboardMatches,
} from "./chat/intents.js";
import {
  extractEntityIds,
  attachIdChipsBelowLastAssistant,
} from "./chat/entitiesHelper.js";

let history = [];
let pendingExternal = null; // { name: string, askedAt: number }

export function initChat() {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const sys = document.getElementById("chatSystemPrompt");
  const useWeb = document.getElementById("chatUseWeb");
  const webProvider = document.getElementById("chatWebProvider");
  if (!form || !input) return;

  // --- Fuzzy suggestion dropdown (uses /entities/suggest) ---
  // Lightweight, non-intrusive helper that surfaces internal Entity matches
  // while user types. Does not alter submit flow; selecting a suggestion
  // simply fills the input and auto-attempts internal resolution.
  let suggestionBox = null;
  let lastSuggestQuery = "";
  let pendingSuggestAbort = null;

  function ensureSuggestionBox() {
    if (suggestionBox) return suggestionBox;
    suggestionBox = document.createElement("div");
    suggestionBox.id = "chatSuggestions";
    suggestionBox.className =
      "absolute left-3 right-28 top-full mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow text-sm max-h-60 overflow-y-auto z-50 hidden";
    // Positioning: make parent relative
    form.classList.add("relative");
    form.appendChild(suggestionBox);
    // Hide on outside click
    document.addEventListener("click", (e) => {
      if (!suggestionBox) return;
      if (suggestionBox.contains(e.target) || e.target === input) return;
      hideSuggestions();
    });
    return suggestionBox;
  }

  function hideSuggestions() {
    if (suggestionBox) suggestionBox.classList.add("hidden");
  }

  function renderSuggestions(items, query) {
    const box = ensureSuggestionBox();
    box.innerHTML = "";
    if (!items?.length) {
      hideSuggestions();
      return;
    }
    items.forEach((it) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className =
        "block w-full text-left px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 border-b last:border-b-0 border-gray-100 dark:border-gray-800";
      const type = it.type ? ` · ${it.type}` : "";
      const score = it.score != null ? ` (score=${it.score})` : "";
      // Basic highlight: bold the matching part if name contains the query
      const name = it.name || it.id;
      const nameLower = name.toLowerCase();
      const qLower = query.toLowerCase();
      let labelHtml = name;
      const idx = nameLower.indexOf(qLower);
      if (idx >= 0) {
        const before = name.slice(0, idx);
        const match = name.slice(idx, idx + query.length);
        const after = name.slice(idx + query.length);
        labelHtml = `${before}<strong class=\"text-indigo-600 dark:text-indigo-300\">${match}</strong>${after}`;
      }
      row.innerHTML = `${labelHtml} <span class=\"text-gray-500 dark:text-gray-400\">[${it.id}]${type}${score}</span>`;
      row.addEventListener("click", async () => {
        input.value = it.id; // prefer id for deterministic resolution
        hideSuggestions();
        input.focus();
        // Attempt immediate internal resolution & dashboard load (non-blocking)
        try {
          const entityId = await tryResolveEntityInput(it.id);
          if (entityId) {
            const root = document.getElementById("rootId");
            if (root) root.value = entityId;
            const initRoot = document.getElementById("initialRootId");
            if (initRoot) initRoot.value = entityId;
            revealDashboard();
            await loadFullDashboardAndSnapshot(
              entityId,
              entityId,
              "Dashboard 快照"
            );
          }
        } catch (_) {}
      });
      box.appendChild(row);
    });
    box.classList.remove("hidden");
  }

  async function fetchSuggestions(q) {
    const query = (q || "").trim();
    if (!query || query.length < 2) {
      hideSuggestions();
      return;
    }
    if (query === lastSuggestQuery) return; // avoid redundant calls
    lastSuggestQuery = query;
    if (pendingSuggestAbort) {
      pendingSuggestAbort.abort();
    }
    pendingSuggestAbort = new AbortController();
    try {
      const res = await fetch(
        `/entities/suggest?q=${encodeURIComponent(query)}`,
        { signal: pendingSuggestAbort.signal }
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      renderSuggestions(data.items || [], query);
    } catch (_) {
      // Silently ignore (user may be typing fast or aborted)
    }
  }

  // Debounce typing + respect IME composition to cut down request volume.
  const SUGGEST_DEBOUNCE_MS = 250;
  let suggestTimer = null;
  let isComposing = false;

  input.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  input.addEventListener("compositionend", () => {
    isComposing = false;
    scheduleSuggestionFetch();
  });

  function scheduleSuggestionFetch() {
    if (isComposing) return; // wait until IME finished
    const val = input.value;
    // Cancel any in-flight debounce
    if (suggestTimer) clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => {
      fetchSuggestions(val);
    }, SUGGEST_DEBOUNCE_MS);
  }

  input.addEventListener("input", () => {
    scheduleSuggestionFetch();
  });
  input.addEventListener("keydown", (e) => {
    // ESC hides suggestions immediately
    if (e.key === "Escape") hideSuggestions();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // --- New: fuzzy match list shown as a chat message before resolution ---
    // If user entered a probable free-text name (not a direct id like E1/P2), surface
    // suggestion candidates in the conversation so they can explicitly choose.
    const idPattern = /^(E\d+|P\d+)$/i;
    let showedFuzzyList = false;
    if (!idPattern.test(text)) {
      try {
        const res = await fetch(
          `/entities/suggest?q=${encodeURIComponent(text)}`
        );
        if (res.ok) {
          const data = await res.json();
          const items = data.items || [];
          // Only show if we have at least 2 candidates (single candidate can be auto-resolved later)
          if (items.length >= 2) {
            // Ensure chat layout is activated prior to appending assistant content
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
            history.push({ role: "user", content: text });
            input.value = "";
            // Render fuzzy match list as an assistant message card
            const wrap = document.createElement("div");
            // Taller container, card style, shadow, flex column
            wrap.className =
              "rounded-xl mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col w-full";
            // Enforce height via inline style to override Tailwind

            // Sticky header
            const heading = document.createElement("div");
            heading.className =
              "px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2 sticky top-0 z-10 backdrop-blur-sm shrink-0";
            heading.innerHTML = `<svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg> 可能匹配的实体 (${items.length})`;
            wrap.appendChild(heading);

            const listEl = document.createElement("ul");
            listEl.className =
              "divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto custom-scrollbar";

            // Helper to render a pill/badge
            function makeBadge(
              label,
              value,
              colorClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            ) {
              if (value == null) return "";
              return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${colorClass} mr-2 mb-1 border border-slate-200 dark:border-slate-700/50">
                    <span class="opacity-70 mr-1">${label}:</span> ${value}
                </span>`;
            }

            // 直接展示匹配实体的富信息（不再需要“预览”按钮或二次请求）
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
              const provenance = it.provenance || {};

              let html = "";

              // High priority badges
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
              if (basic.nationality)
                html += makeBadge("国籍", basic.nationality);
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
                html += makeBadge(
                  "关系密度",
                  network.relationship_density_score
                );
              if (geo.primary_country)
                html += makeBadge("主要国家", geo.primary_country);

              // Description fallback if not empty
              if (!html && it.description) {
                html = `<span class="text-slate-500 dark:text-slate-400 italic text-[10px]">${it.description}</span>`;
              } else if (!html) {
                html = `<span class="text-slate-400 dark:text-slate-500 text-[10px]">无详细信息</span>`;
              }

              box.innerHTML = html;
              li.appendChild(box);
            }

            items.slice(0, 20).forEach((it) => {
              const li = document.createElement("li");
              li.className =
                "group p-4 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 cursor-pointer transition-all duration-200 border-l-4 border-transparent hover:border-indigo-500 dark:hover:border-indigo-400";

              const name = (it.name || it.id || "").trim();
              const type = it.type || "Entity";

              // Header row
              li.innerHTML = `
                <div class="flex items-start justify-between mb-1">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-slate-800 dark:text-slate-100 text-sm">${name}</span>
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">${
                          it.id
                        }</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">${type}</span>
                    </div>
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-1">
                    ${it.description || ""}
                </div>
              `;

              // Primary click loads full dashboard
              li.addEventListener("click", async () => {
                try {
                  const entityId = await tryResolveEntityInput(it.id);
                  if (entityId) {
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
                    history.push({
                      role: "assistant",
                      content: `已选择并加载实体: [${entityId}]`,
                    });
                  } else {
                    appendMessage(
                      "assistant",
                      `未能加载实体: ${it.id}`,
                      targetList
                    );
                  }
                } catch (err) {
                  appendMessage(
                    "assistant",
                    `加载实体出错: ${err}`,
                    targetList
                  );
                }
              });
              // 直接渲染富信息
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
            targetList.parentElement &&
              (targetList.parentElement.scrollTop =
                targetList.parentElement.scrollHeight);
            showedFuzzyList = true;
            // Stop normal resolution flow; wait for user selection.
            return;
          }
        }
      } catch (_) {
        // Ignore fuzzy errors silently; fall through to normal handling.
      }
    }

    // On first submit, move chat from center to bottom dock and reveal messages
    const chatSection = document.getElementById("chatSection");
    const msgs = document.getElementById("chatMessages");
    if (chatSection && chatSection.classList.contains("centered")) {
      chatSection.classList.remove("centered");
      chatSection.classList.add("docked");
      msgs?.classList.remove("hidden");
      // Toggle layout padding for docked chat on small screens
      document.body.classList.add("chat-docked");
    }

    // Ensure dashboard area is visible alongside the conversation
    revealDashboard();

    // Create a fresh conversation card for this turn
    const convo = createConversationCard("对话");
    const targetList =
      convo?.messagesEl || document.getElementById("chatMessages");

    // Show and store user message
    appendMessage("user", text, targetList);
    history.push({ role: "user", content: text });
    input.value = "";

    // Fire lightweight intents to update dashboard contextually (non-blocking)
    triggerDashboardIntents(text);

    // If awaiting external details, treat this message as extra info and proceed
    if (pendingExternal && pendingExternal.name) {
      try {
        const bd = extractBirthdate(text);
        // Allow user to skip providing details
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
        await externalLookup(pendingExternal.name, bd || "");
      } catch (err) {
        appendMessage("assistant", `外部检索出错：${err}`, targetList);
      } finally {
        pendingExternal = null;
      }
      return;
    }

    // Try to extract a quoted entity name for internal resolution, e.g.:
    // help me search "Acme Holdings Ltd"
    // We match any straight or curly quotes.
    const m = text.match(/["“”'‘’]([^"“”'‘’]+)["“”'‘’]/);
    const candidate = m ? m[1].trim() : null;

    if (candidate) {
      try {
        const entityId = await tryResolveEntityInput(candidate);
        if (entityId) {
          // Update the root input fields
          const root = document.getElementById("rootId");
          if (root) root.value = entityId;
          const initRoot = document.getElementById("initialRootId");
          if (initRoot) initRoot.value = entityId;

          // Reveal dashboard sections so entity details and panels show as part of the answer
          revealDashboard();

          // Load full canonical dashboard and create a snapshot for this turn
          await loadFullDashboardAndSnapshot(
            entityId,
            candidate,
            "Dashboard 快照"
          );

          // Respond inline without invoking the LLM
          appendMessage(
            "assistant",
            `Found internal entity and loaded its details: [${entityId}].`,
            targetList
          );
          history.push({
            role: "assistant",
            content: `Found internal entity and loaded its details: [${entityId}].`,
          });
          return; // skip LLM/web flow when resolved internally
        }
        // If resolution failed (e.g., 404) keep dashboard visible and fall through to name-scan/LLM
      } catch (err) {
        // Non-fatal; keep dashboard visible and fall back to LLM/web chat
      }
    }

    // No quoted candidate or not resolved: try resolving the whole input as an entity id/name
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
        history.push({
          role: "assistant",
          content: `Found internal entity and loaded its details: [${entityId2}].`,
        });
        return;
      }
      // If still not resolved, continue to name-scan/LLM
    } catch (_) {}

    // If still not resolved internally, run basic name scan and show a card inside this turn
    const nameForScan = candidate || text;
    const scan = await fetchNameScan(nameForScan);
    renderNameScanCard(nameForScan, scan);

    // Then ask user for optional extra info for external lookup and set pending state
    pendingExternal = { name: nameForScan, askedAt: Date.now() };
    appendMessage(
      "assistant",
      "未找到内部实体，已完成基础姓名扫描（相似客户与本地名单命中已在下方卡片展示）。\n如需进一步从公开来源检索，请补充以下信息（可任意填写或回复“跳过”）：\n- 出生日期（例如 1990-01-02）\n- 可能的户籍/地区\n- 常用别名或相关公司名称",
      targetList
    );
    return;

    // External clarification path not taken: proceed with normal LLM chat flow
    appendMessage("assistant", "…", targetList);

    try {
      const body = {
        message: text,
        history,
        system_prompt: sys ? sys.value.trim() || undefined : undefined,
        use_web: !!(useWeb && useWeb.checked),
        web_provider: webProvider ? webProvider.value : undefined,
      };
      const resp = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      // Replace last assistant placeholder with real content
      const list = targetList || document.getElementById("chatMessages");
      const last = list?.lastElementChild;
      const reply = data.reply || "";
      if (last) last.textContent = reply;
      else appendMessage("assistant", reply, list);
      history.push({ role: "assistant", content: reply });

      // If reply mentions dashboard-intents, render a small hint card and also trigger actions
      const matches = getDashboardMatches(reply);
      if (matches.length) {
        createDashboardHintCard(matches);
        // Also trigger non-blocking updates to the relevant dashboard cards
        triggerDashboardIntents(reply);
      }

      // Detect entity ids in reply and attach quick chips; auto-load first
      const ids = extractEntityIds(reply);
      if (ids.length) {
        attachIdChipsBelowLastAssistant(ids, list);
        // Auto-load the first one to make dashboard part of the answer
        const first = ids[0];
        const root = document.getElementById("rootId");
        if (root) root.value = first;
        revealDashboard();
        // Load full canonical dashboard and snapshot for the first detected id
        await loadFullDashboardAndSnapshot(first, first, "Dashboard 快照");
      }

      // If sources provided, render them as a tiny citation list below
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
  });

  // Optional: clear button
  const clearBtn = document.getElementById("chatClear");
  clearBtn?.addEventListener("click", () => {
    history = [];
    const list = document.getElementById("chatMessages");
    if (list) list.innerHTML = "";
    // Hide legacy transcript section (new per-turn cards remain for context unless removed below)
    document.getElementById("chatTranscriptSection")?.classList.add("hidden");
    // Return chat UI to centered state
    const chatSection = document.getElementById("chatSection");
    chatSection?.classList.remove("docked");
    chatSection?.classList.add("centered");
    // Hide messages area until next use and refocus the input
    list?.classList.add("hidden");
    const inputEl = document.getElementById("chatInput");
    inputEl?.focus();
    // Remove docked padding from layout
    document.body.classList.remove("chat-docked");

    // Remove dynamically created per-turn chat cards for a full reset
    document
      .querySelectorAll(".chat-conversation-card")
      .forEach((el) => el.remove());

    // Also remove all dashboard snapshot cards created per turn
    document
      .querySelectorAll(".chat-dashboard-snapshot")
      .forEach((el) => el.remove());

    // Also clear any suggestion cards and the vertical stream container
    const stream = document.getElementById("chatTurnStream");
    if (stream) stream.innerHTML = "";

    // Keep canonical panels hidden after clear
    hideCanonicalPanels();

    hideSuggestions();
  });
}
