// chat/flow.js
// High-level chat submit orchestration (delegates to modular helpers).
import { externalLookup } from "../external.js";
import { fetchNameScan, renderNameScanCard, extractBirthdate } from "./scan.js";
import { revealDashboard } from "./dashboard.js";
import { createConversationCard, appendMessage } from "./conversation.js";
import { triggerDashboardIntents } from "./intents.js";
import {
  chatState,
  pushHistory,
  setPendingExternal,
  consumePendingExternal,
} from "./state.js";
import { maybeRenderFuzzyList } from "./fuzzyList.js";
import { resolveQuotedCandidate, resolveWholeInput } from "./fastpaths.js";
import { runLLM } from "./llm.js";
import { processReply } from "./postReply.js";

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

  // 1. Fuzzy multi-candidate pre-display (early return if card rendered)
  const fuzzyHandled = await maybeRenderFuzzyList(text);
  if (fuzzyHandled) return;

  // 2. Layout activation & base user message
  activateDockLayout();
  const convo = createConversationCard("对话");
  const targetList =
    convo?.messagesEl || document.getElementById("chatMessages");
  appendMessage("user", text, targetList);
  pushHistory("user", text);
  if (input) input.value = "";

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

  // 7. LLM / graphRAG inference
  const data = await runLLM({
    text,
    sysEl,
    useWebEl,
    webProviderEl,
    targetList,
  });
  const reply = data.reply || "";

  // 8. Reply post-processing (person resolver, hints, chips, sources)
  await processReply({ data, reply, candidate: candidate || text, targetList });

  // 9. Supplementary name scan & external prompt staging
  await supplementaryScanAndStageExternal(candidate || text, targetList);
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
    await externalLookup(pending.name, bd || "");
  } catch (err) {
    appendMessage("assistant", `外部检索出错：${err}`, targetList);
  } finally {
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
