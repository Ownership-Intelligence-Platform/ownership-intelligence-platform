// chat/llm.js
// Encapsulates LLM / graphRAG call.
import { appendMessage } from "./conversation.js";
import { chatState, pushHistory } from "./state.js";
import { renderYoutuCard } from "./youtuCard.js";

export async function runLLM({
  text,
  sysEl,
  useWebEl,
  webProviderEl,
  targetList,
  useYoutu = false,
}) {
  appendMessage("assistant", "…", targetList);
  try {
    const body = {
      message: text,
      history: chatState.history,
      system_prompt: sysEl ? sysEl.value.trim() || undefined : undefined,
      use_web: !!(useWebEl && useWebEl.checked),
      web_provider: webProviderEl ? webProviderEl.value : undefined,
      use_person_resolver: true,
      use_youtu: useYoutu,
    };
    const resp = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    if (useYoutu && data.youtu_data) {
      renderYoutuCard(data, targetList);
      pushHistory("assistant", data.reply || "Youtu GraphRAG Result");
      return data;
    }

    const last = targetList?.lastElementChild;
    const reply = data.reply || "";
    if (last) last.textContent = reply;
    else appendMessage("assistant", reply, targetList);
    pushHistory("assistant", reply);
    return data;
  } catch (err) {
    const last = targetList?.lastElementChild;
    const msg = `Error: ${err}`;
    if (last) last.textContent = msg;
    else appendMessage("assistant", msg, targetList);
    return { reply: msg, error: true };
  }
}
