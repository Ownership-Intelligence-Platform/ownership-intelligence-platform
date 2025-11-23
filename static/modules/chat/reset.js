// chat/reset.js
// Encapsulates clear/reset functionality for the chat UI.
import { clearHistory, setPendingExternal } from "./state.js";
import { hideCanonicalPanels } from "./dashboard.js";

export function setupReset({ clearButtonId = "chatClear" }) {
  const clearBtn = document.getElementById(clearButtonId);
  if (!clearBtn) return;
  clearBtn.addEventListener("click", () => {
    clearHistory();
    setPendingExternal(null);
    const list = document.getElementById("chatMessages");
    if (list) list.innerHTML = "";
    document.getElementById("chatTranscriptSection")?.classList.add("hidden");
    const chatSection = document.getElementById("chatSection");
    chatSection?.classList.remove("docked");
    chatSection?.classList.add("centered");
    list?.classList.add("hidden");
    const inputEl = document.getElementById("chatInput");
    inputEl?.focus();
    document.body.classList.remove("chat-docked");
    document
      .querySelectorAll(".chat-conversation-card")
      .forEach((el) => el.remove());
    document
      .querySelectorAll(".chat-dashboard-snapshot")
      .forEach((el) => el.remove());
    const stream = document.getElementById("chatTurnStream");
    if (stream) stream.innerHTML = "";
    hideCanonicalPanels();
    // Suggestion box hide handled by suggestions module when ESC or outside click.
  });
}
