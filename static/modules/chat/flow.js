// chat/flow.js
// High-level chat submit orchestration (delegates to modular helpers).
import { externalLookup } from "../external.js";
import { fetchNameScan, renderNameScanCard, extractBirthdate } from "./scan.js";
import { revealDashboard } from "./dashboard.js";
import { createConversationCard, appendMessage } from "./conversation.js";
import { renderPersonResolverCard } from "./personResolverCard.js";
import { renderMcpResults } from "./mcpRenderer.js";
import { triggerDashboardIntents } from "./intents.js";
import {
  chatState,
  pushHistory,
  setPendingExternal,
  consumePendingExternal,
} from "./state.js";
import { maybeRenderFuzzyList } from "./fuzzyList.js";
import { resolveQuotedCandidate, resolveWholeInput } from "./fastpaths.js";
import { showLoading, hideLoading } from "../utils.js";
// LLM and post-processing disabled for graph-only mode per user preference.
import { runLLM } from "./llm.js";
// import { processReply } from "./postReply.js";

// Utility for toggling tall conversation card class (shared by fuzzy list)
export function setLastConversationTall(isTall) {
  try {
    const lastCard = document.querySelector(
      "#chatTurnStream .chat-conversation-card:last-of-type"
    );
    if (!lastCard) return;
    lastCard.classList.toggle("chat-conversation-card--tall", !!isTall);
  } catch (_) {}
}

export async function handleChatSubmit({
  text,
  sysEl,
  useWebEl,
  webProviderEl,
}) {
  if (!text) return;
  const input = document.getElementById("chatInput");

  // Heuristic: detect short/simple name queries (e.g. "李晨") and skip the
  // fuzzy pre-display so they follow the same parse-and-resolve -> graphRAG/MCP
  // path as longer contextual queries such as "西安市的李晨". This makes
  // the displayed candidate card consistent between short names and contextual
  // queries.
  const trimmed = String(text || "").trim();
  const isChineseName = /^[\u4e00-\u9fff·•]{2,6}$/.test(trimmed);
  const isLatinShortName =
    /^[A-Za-z .,'-]{2,40}$/.test(trimmed) && trimmed.split(/\s+/).length <= 3;
  const isShortName = isChineseName || isLatinShortName;

  let fuzzyHandled = false;
  if (!isShortName) {
    // preserve existing fuzzy-list behavior for longer or complex queries
    fuzzyHandled = await maybeRenderFuzzyList(text);
    if (fuzzyHandled) return;
  }

  // 2. Layout activation & base user message
  activateDockLayout();
  const convo = createConversationCard("对话");
  const targetList =
    convo?.messagesEl || document.getElementById("chatMessages");
  appendMessage("user", text, targetList);
  pushHistory("user", text);
  if (input) input.value = "";

  // Check Youtu toggle
  const useYoutuEl = document.getElementById("chatUseYoutu");
  if (useYoutuEl && useYoutuEl.checked) {
    showLoading("正在调用 Youtu GraphRAG...");
    try {
      await runLLM({
        text,
        sysEl,
        useWebEl,
        webProviderEl,
        targetList,
        useYoutu: true,
      });
    } finally {
      hideLoading();
    }
    return;
  }

  // 3. Lightweight dashboard intents
  triggerDashboardIntents(text);

  // 4. Pending external enrichment branch
  if (await processPendingExternal(text, targetList)) return;

  // 5. Fast-path quoted candidate resolution
  const { handled: quotedHandled, candidate } = await resolveQuotedCandidate(
    text,
    targetList
  );
  if (quotedHandled) return;

  // 6. Fast-path whole input resolution
  const wholeHandled = await resolveWholeInput(text, targetList);
  if (wholeHandled) return;

  // 7. Use LLM only for structured extraction: call backend parse-and-resolve
  // endpoint which runs parse_person_query (LLM) then resolve_graphrag and
  // returns structured candidates. We deliberately do not display any
  // LLM-generated explanatory text — only the resolver candidates.
  const noGraphMatch = !(quotedHandled || wholeHandled);
  if (noGraphMatch) {
    showLoading("正在智能解析...");
    try {
      const resp = await fetch("/entities/parse-and-resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, use_semantic: true, top_k: 5 }),
      });
      if (!resp.ok) {
        // If parse-and-resolve fails or returns 404-like, fall back to UX msg
        appendMessage(
          "assistant",
          "未在内部图谱中找到候选（或解析失败）。请尝试只输入姓名或使用建议列表。",
          targetList
        );
        pushHistory("assistant", "图谱解析失败或无候选（parse-and-resolve）。");
      } else {
        const data = await resp.json();
        const parsed = data.parsed || {};
        const resolver = data.resolver || {};
        const candidates = resolver.candidates || resolver["candidates"] || [];
        if (candidates && candidates.length) {
          // Render compact person resolver card (graph-only candidates)
          try {
            renderPersonResolverCard(
              parsed.name || text,
              candidates,
              targetList
            );
            pushHistory(
              "assistant",
              `图谱匹配到 ${candidates.length} 个候选（仅显示前 ${Math.min(
                5,
                candidates.length
              )} 条）。`
            );
          } catch (e) {
            console.error("Failed to render person resolver card", e);
          }
        } else {
          // No internal graph candidates: fallback to querying configured MCPs (mocked)
          appendMessage(
            "assistant",
            "未在内部图谱中找到候选。已尝试从公开来源进行联查（来自配置的 MCP）。",
            targetList
          );
          pushHistory(
            "assistant",
            "未在内部图谱中找到候选，开始从 MCP 联查（mock）。"
          );
          try {
            const mcpResp = await fetch("/entities/mcp-search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: text,
                parsed: parsed || {},
                top_k: 6,
              }),
            });
            if (mcpResp.ok) {
              const mcpData = await mcpResp.json();
              const results = mcpData.results || [];
              if (results.length) {
                // Render MCP results card
                try {
                  renderMcpResults(parsed.name || text, results, targetList);
                  pushHistory(
                    "assistant",
                    `从公开来源检索到 ${results.length} 条候选（mock）。`
                  );
                } catch (e) {
                  console.error("Failed to render MCP results", e);
                }
              } else {
                appendMessage(
                  "assistant",
                  "公开来源也未返回匹配结果。",
                  targetList
                );
              }
            } else {
              appendMessage(
                "assistant",
                "调用公开来源检索失败（MCP）。",
                targetList
              );
            }
          } catch (err) {
            console.error("MCP search error", err);
          }
        }
      }
    } catch (err) {
      appendMessage(
        "assistant",
        `解析/检索出错：${err}。请重试或只输入姓名进行匹配。`,
        targetList
      );
    } finally {
      hideLoading();
    }
  }

  // 9. Supplementary name scan & external prompt staging
  // Only perform the supplementary name scan when a confirmed person
  // has been selected (rootId present and looks like a person id `P...`).
  // This avoids showing name-scan information when no person was chosen.
  try {
    const rootVal = document.getElementById("rootId")?.value?.trim();
    if (rootVal && /^P\w+/i.test(rootVal)) {
      await supplementaryScanAndStageExternal(candidate || text, targetList);
    }
  } catch (_) {
    // swallow and continue
  }
}

function activateDockLayout() {
  const chatSection = document.getElementById("chatSection");
  const msgs = document.getElementById("chatMessages");
  if (chatSection && chatSection.classList.contains("centered")) {
    chatSection.classList.remove("centered");
    chatSection.classList.add("docked");
    msgs?.classList.remove("hidden");
    document.body.classList.add("chat-docked");
  }
}

async function processPendingExternal(text, targetList) {
  const pending = chatState.pendingExternal;
  if (!(pending && pending.name)) return false;
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
    showLoading("正在检索公开信息...");
    await externalLookup(pending.name, bd || "");
  } catch (err) {
    appendMessage("assistant", `外部检索出错：${err}`, targetList);
  } finally {
    hideLoading();
    consumePendingExternal();
  }
  return true;
}

async function supplementaryScanAndStageExternal(nameForScan, targetList) {
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
