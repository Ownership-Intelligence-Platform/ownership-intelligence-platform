// Simple chat widget logic for the AI Assistant panel
// Enhancements: detect quoted entity names in messages to resolve against
// internal data first; if found, load the Entity Info card and show a
// lightweight confirmation reply without invoking the LLM. Otherwise,
// maintain in-memory history and call backend /chat endpoint.

import { resolveEntityInput, tryResolveEntityInput } from "./utils.js";
import { loadEntityInfo } from "./entities.js";
import { loadLayers } from "./layers.js";
import { loadAccounts } from "./accounts.js";
import { loadTransactions } from "./transactions.js";
import { loadGuarantees } from "./guarantees.js";
import { loadSupplyChain } from "./supplyChain.js";
import { loadEmployment } from "./employment.js";
import { loadLocations } from "./locations.js";
import { loadNews } from "./news.js";
import { analyzeRisks } from "./risks.js";
import { loadPenetration } from "./penetration.js";
import { loadPersonOpening } from "./personOpening.js";
import { loadPersonNetwork as loadPersonNetworkEmbed } from "./personNetworkEmbed.js";
import { externalLookup } from "./external.js";

let history = [];
let pendingExternal = null; // { name: string, askedAt: number }

async function fetchNameScan(name) {
  const q = String(name || "").trim();
  if (!q) return null;
  try {
    const res = await fetch(`/name-scan?q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function renderNameScanCard(name, scan) {
  if (!scan) return;
  const stream = ensureStreamContainer();
  const card = document.createElement("section");
  card.className =
    "rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 shadow-sm";

  const head = document.createElement("div");
  head.className =
    "px-4 py-3 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between";
  const h = document.createElement("h3");
  h.className = "text-base font-semibold text-amber-900 dark:text-amber-50";
  h.textContent = `姓名扫描：${name}`;
  head.appendChild(h);
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "p-3 grid grid-cols-1 md:grid-cols-2 gap-3";

  const left = document.createElement("div");
  const leftTitle = document.createElement("div");
  leftTitle.className = "text-sm font-medium mb-1";
  leftTitle.textContent = "内部实体模糊匹配";
  left.appendChild(leftTitle);
  const leftList = document.createElement("div");
  leftList.className = "space-y-1 text-xs text-gray-900 dark:text-gray-50";
  const efm = scan.entity_fuzzy_matches || [];
  if (!efm.length) {
    leftList.textContent = "暂无相似实体";
  } else {
    efm.forEach((m) => {
      const row = document.createElement("div");
      row.className = "border border-gray-200 dark:border-gray-700 rounded px-2 py-1";
      const type = m.type ? ` · ${m.type}` : "";
      const desc = m.description
        ? `\n${m.description}`
        : "";
      row.textContent = `${m.name || "(无名称)"} [${m.id}]${type} (score=${
        m.score ?? "-"
      })${desc}`;
      leftList.appendChild(row);
    });
  }
  left.appendChild(leftList);

  const right = document.createElement("div");
  const rightTitle = document.createElement("div");
  rightTitle.className = "text-sm font-medium mb-1";
  rightTitle.textContent = "本地名单命中";
  right.appendChild(rightTitle);
  const rightList = document.createElement("div");
  rightList.className = "space-y-1 text-xs text-gray-900 dark:text-gray-50";
  const hits = scan.watchlist_hits || [];
  if (!hits.length) {
    rightList.textContent = "暂无名单命中";
  } else {
    hits.forEach((w) => {
      const row = document.createElement("div");
      row.className = "border border-red-200 dark:border-red-700 rounded px-2 py-1";
      const risk = w.risk_level ? `风险等级: ${w.risk_level}` : "";
      const list = w.list ? `名单: ${w.list}` : "";
      const meta = [list, risk].filter(Boolean).join(" · ");
      row.textContent = `${w.name} (${w.type || ""})${
        meta ? " - " + meta : ""
      }${w.notes ? "\n" + w.notes : ""}`;
      rightList.appendChild(row);
    });
  }
  right.appendChild(rightList);

  body.appendChild(left);
  body.appendChild(right);
  card.appendChild(body);
  stream.appendChild(card);
  return card;
}

function extractBirthdate(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  // Try YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  let m = t.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = m[2].padStart(2, "0");
    const d = m[3].padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  // Try YYYYMMDD
  m = t.match(/\b(\d{4})(\d{2})(\d{2})\b/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  // Try Chinese date: 1990年1月2日
  m = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (m) {
    const y = m[1];
    const mo = m[2].padStart(2, "0");
    const d = m[3].padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  return null;
}

function ensureStreamContainer() {
  let stream = document.getElementById("chatTurnStream");
  if (!stream) {
    const right = document.getElementById("rightPanel") || document.body;
    stream = document.createElement("section");
    stream.id = "chatTurnStream";
    stream.className = "flex flex-col gap-4";
    right.appendChild(stream);
  }
  return stream;
}

function hideCanonicalPanels() {
  [
    "chatTranscriptSection",
    "controlsSection",
    "entityInfoSection",
    "dashboardSection",
  ].forEach((id) => document.getElementById(id)?.classList.add("hidden"));
}

// Create a fresh "对话" card inside the dashboard grid for each submit
function createConversationCard(titleText) {
  const stream = ensureStreamContainer();
  const wrapper = document.createElement("section");
  wrapper.className =
    "rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm chat-conversation-card";

  const header = document.createElement("div");
  header.className =
    "px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between";
  const h = document.createElement("h3");
  h.className = "text-base font-semibold";
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  h.textContent = `${titleText || "对话"} · ${hh}:${mm}`;
  header.appendChild(h);
  wrapper.appendChild(header);

  const body = document.createElement("div");
  body.className = "max-h-[28vh] overflow-y-auto p-3 space-y-2";
  wrapper.appendChild(body);

  stream.appendChild(wrapper);
  return { cardEl: wrapper, messagesEl: body };
}

// When reply hints certain dashboards, add a small hint card with quick actions
function createDashboardHintCard(matches) {
  if (!matches?.length) return null;
  const stream = ensureStreamContainer();
  const card = document.createElement("section");
  card.className =
    "rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm";
  const head = document.createElement("div");
  head.className =
    "px-4 py-3 border-b border-indigo-200 dark:border-indigo-800 flex items-center justify-between";
  const h = document.createElement("h3");
  h.className = "text-base font-semibold text-indigo-900 dark:text-indigo-100";
  h.textContent = "Dashboard 建议";
  head.appendChild(h);
  card.appendChild(head);
  const body = document.createElement("div");
  body.className = "p-3 text-sm text-indigo-900/80 dark:text-indigo-100/90";
  const p = document.createElement("div");
  p.className = "mb-2";
  p.textContent = "已匹配主题：";
  body.appendChild(p);
  const wrap = document.createElement("div");
  wrap.className = "flex flex-wrap gap-2";
  matches.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "inline-flex items-center rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500";
    btn.textContent = m.label;
    btn.addEventListener("click", () => {
      // Dispatch the mapped action when user clicks the chip
      document.getElementById(m.id)?.dispatchEvent(new Event("click"));
    });
    wrap.appendChild(btn);
  });
  body.appendChild(wrap);
  card.appendChild(body);
  stream.appendChild(card);
  return card;
}

// Deep strip id attributes to avoid duplicate IDs in snapshot copies
function stripIdsDeep(root) {
  if (!root) return;
  if (root.nodeType === 1 /* element */ && root.hasAttribute("id")) {
    root.removeAttribute("id");
  }
  const all = root.querySelectorAll("[id]");
  all.forEach((el) => el.removeAttribute("id"));
}

// Clone a section by id, remove hidden, strip ids, and return the clone (or null)
function clonedSection(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const clone = el.cloneNode(true);
  clone.classList.remove("hidden");
  stripIdsDeep(clone);
  return clone;
}

// Create a card that contains a static snapshot of Entity Info + Dashboard grid
function createDashboardSnapshotCard(titleText, entityId) {
  const stream = ensureStreamContainer();
  const wrapper = document.createElement("section");
  wrapper.className =
    "rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm chat-dashboard-snapshot";
  const head = document.createElement("div");
  head.className =
    "px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between";
  const h = document.createElement("h3");
  h.className = "text-base font-semibold";
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const subtitle = entityId ? ` · ${entityId}` : "";
  h.textContent = `${titleText || "Dashboard"}${subtitle} · ${hh}:${mm}`;
  head.appendChild(h);
  wrapper.appendChild(head);
  const body = document.createElement("div");
  body.className = "p-3";
  // Clone controls, entity info and dashboard grid
  const controlsClone = clonedSection("controlsSection");
  const infoClone = clonedSection("entityInfoSection");
  const grid = document.getElementById("dashboardSection");
  const gridClone = grid ? grid.cloneNode(true) : document.createElement("div");
  gridClone.classList.remove("hidden");
  stripIdsDeep(gridClone);
  if (controlsClone) body.appendChild(controlsClone);
  if (infoClone) body.appendChild(infoClone);
  body.appendChild(gridClone);
  wrapper.appendChild(body);
  // Append into vertical stream so conversation and snapshot stack top-down
  stream.appendChild(wrapper);
  return wrapper;
}

// Load the canonical dashboard for a given root entity, then snapshot it
async function loadFullDashboardAndSnapshot(
  rootId,
  rawInput,
  snapshotTitle = "Dashboard"
) {
  const rootInput = document.getElementById("rootId");
  if (rootInput) rootInput.value = rootId;
  // Load into canonical panels while keeping them hidden to avoid duplicates
  hideCanonicalPanels();
  try {
    // Read current UI options for directions/filters
    const txDir =
      document.getElementById("txDirection")?.value?.trim() || "out";
    const gDir =
      document.getElementById("guaranteeDirection")?.value?.trim() || "out";
    const sDir =
      document.getElementById("supplyDirection")?.value?.trim() || "out";
    const role =
      document.getElementById("employmentRole")?.value?.trim() || "both";
    const newsLimit = parseInt(
      document.getElementById("riskNewsLimit")?.value || "5",
      10
    );

    // Core loads into canonical dashboard
    await loadEntityInfo(rootId);
    await loadLayers();

    await Promise.allSettled([
      loadAccounts(rootId),
      loadTransactions(rootId, txDir),
      loadGuarantees(rootId, gDir),
      loadSupplyChain(rootId, sDir),
      loadEmployment(rootId, role),
      loadLocations(rootId),
      loadNews(rootId),
      analyzeRisks(rootId, newsLimit),
    ]);

    // Penetration graph and person-specific extras
    await Promise.allSettled([
      loadPenetration(),
      rawInput ? loadPersonOpening(rawInput) : Promise.resolve(),
      /^P\w+/i.test(rawInput || "")
        ? (async () => {
            const graphEl = document.getElementById("personNetworkHomeGraph");
            const relationsEl = document.getElementById(
              "personRelationsHomeCard"
            );
            if (graphEl || relationsEl)
              await loadPersonNetworkEmbed(rawInput, { graphEl, relationsEl });
          })()
        : Promise.resolve(),
    ]);
  } catch (_) {
    // Ignore partial failures; snapshot whatever is rendered.
  }
  // Finally create a static snapshot card
  const snap = createDashboardSnapshotCard(snapshotTitle, rootId);
  return snap;
}

function revealDashboard() {
  // No-op to keep canonical panels hidden in chat-driven flow
}

function appendMessage(role, content, targetListEl) {
  const list = targetListEl || document.getElementById("chatMessages");
  if (!list) return;
  // If using legacy transcript card, ensure it's visible
  if (list.id === "chatMessages") {
    document
      .getElementById("chatTranscriptSection")
      ?.classList.remove("hidden");
    if (list.classList.contains("hidden")) list.classList.remove("hidden");
  }
  const item = document.createElement("div");
  item.className = `px-3 py-2 rounded mb-2 text-sm whitespace-pre-wrap ${
    role === "user"
      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 self-end"
      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
  }`;
  item.textContent = content;
  list.appendChild(item);
  // scroll to bottom (guard if container has no parent scroller)
  if (list.parentElement) {
    list.parentElement.scrollTop = list.parentElement.scrollHeight;
  }
}

// Lightweight intent hooks: trigger dashboard refreshes based on user query keywords
function triggerDashboardIntents(text) {
  const t = (text || "").toLowerCase();
  const dispatchClick = (id) =>
    document.getElementById(id)?.dispatchEvent(new Event("click"));
  // Only act if there's a current rootId or the action itself will resolve
  const hasRoot = !!document.getElementById("rootId")?.value?.trim();

  // Mappings (CN + EN keywords)
  const rules = [
    { re: /(交易|transact|transfer)/i, id: "loadTransactions", needRoot: true },
    { re: /(担保|guarantee)/i, id: "loadGuarantees", needRoot: true },
    { re: /(供应链|supply)/i, id: "loadSupplyChain", needRoot: true },
    {
      re: /(任职|就业|职位|employment|role)/i,
      id: "loadEmployment",
      needRoot: true,
    },
    { re: /(地址|location|address)/i, id: "loadLocations", needRoot: true },
    { re: /(新闻|news)/i, id: "loadNews", needRoot: true },
    {
      re: /(穿透|penetration|股权图|graph)/i,
      id: "loadPenetration",
      needRoot: false,
    },
    { re: /(账户|账号|account)/i, id: "loadAccounts", needRoot: true },
    { re: /(风险|risk)/i, id: "analyzeRisks", needRoot: true },
    {
      re: /(人际|关系网络|person network|关系图)/i,
      id: "loadPersonNetwork",
      needRoot: true,
    },
  ];

  for (const r of rules) {
    if (r.re.test(t) && (!r.needRoot || hasRoot)) {
      dispatchClick(r.id);
    }
  }
}

// Return which dashboard intents match a given text (for hint card rendering)
function getDashboardMatches(text) {
  const t = (text || "").toLowerCase();
  const hasRoot = !!document.getElementById("rootId")?.value?.trim();
  const rules = [
    {
      re: /(交易|transact|transfer)/i,
      id: "loadTransactions",
      label: "交易",
      needRoot: true,
    },
    {
      re: /(担保|guarantee)/i,
      id: "loadGuarantees",
      label: "担保",
      needRoot: true,
    },
    {
      re: /(供应链|supply)/i,
      id: "loadSupplyChain",
      label: "供应链",
      needRoot: true,
    },
    {
      re: /(任职|就业|职位|employment|role)/i,
      id: "loadEmployment",
      label: "任职",
      needRoot: true,
    },
    {
      re: /(地址|location|address)/i,
      id: "loadLocations",
      label: "地址",
      needRoot: true,
    },
    { re: /(新闻|news)/i, id: "loadNews", label: "新闻", needRoot: true },
    {
      re: /(穿透|penetration|股权图|graph)/i,
      id: "loadPenetration",
      label: "穿透",
      needRoot: false,
    },
    {
      re: /(账户|账号|account)/i,
      id: "loadAccounts",
      label: "账户",
      needRoot: true,
    },
    { re: /(风险|risk)/i, id: "analyzeRisks", label: "风险", needRoot: true },
    {
      re: /(人际|关系网络|person network|关系图)/i,
      id: "loadPersonNetwork",
      label: "关系网络",
      needRoot: true,
    },
  ];
  const matches = [];
  for (const r of rules) {
    if (r.re.test(t) && (!r.needRoot || hasRoot)) matches.push(r);
  }
  return matches;
}

// Detect entity IDs in assistant reply and offer quick actions (+ auto-load first)
function extractEntityIds(txt) {
  const ids = new Set();
  const re = /(E\d+|P\d+)/g; // basic entity/person id patterns
  let m;
  while ((m = re.exec(txt))) ids.add(m[1]);
  return Array.from(ids);
}

function attachIdChipsBelowLastAssistant(ids, targetListEl) {
  if (!ids?.length) return;
  const list = targetListEl || document.getElementById("chatMessages");
  if (!list) return;
  const chipBox = document.createElement("div");
  chipBox.className =
    "px-3 py-2 rounded mb-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100";
  const title = document.createElement("div");
  title.className = "font-medium mb-1";
  title.textContent = "检测到实体：";
  chipBox.appendChild(title);
  const wrap = document.createElement("div");
  wrap.className = "flex flex-wrap gap-2";
  ids.forEach((id) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-2.5 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-700";
    btn.textContent = id;
    btn.addEventListener("click", async () => {
      const root = document.getElementById("rootId");
      if (root) root.value = id;
      const snap = await loadFullDashboardAndSnapshot(id, id, "Dashboard 快照");
      // Scroll to the newly created snapshot
      snap?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    wrap.appendChild(btn);
  });
  chipBox.appendChild(wrap);
  list.appendChild(chipBox);
  if (list.parentElement) {
    list.parentElement.scrollTop = list.parentElement.scrollHeight;
  }
}

export function initChat() {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const sys = document.getElementById("chatSystemPrompt");
  const useWeb = document.getElementById("chatUseWeb");
  const webProvider = document.getElementById("chatWebProvider");
  if (!form || !input) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

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
  });
}
