// Chat orchestration module after modular split.
// Delegates suggestions, submit flow, and reset logic to dedicated modules.
import { setupSuggestions } from "./chat/suggestions.js";
import { handleChatSubmit, setLastConversationTall } from "./chat/flow.js";
import { setupReset } from "./chat/reset.js";

export function initChat() {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const sys = document.getElementById("chatSystemPrompt");
  const useWeb = document.getElementById("chatUseWeb");
  const webProvider = document.getElementById("chatWebProvider");
  if (!form || !input) return;

  // Initialize suggestion dropdown logic
  const suggestions = setupSuggestions({
    form,
    input,
    onSelect: () => {},
    setLastConversationTall,
  });

  // Attach reset handler (clears history & UI)
  setupReset({ clearButtonId: "chatClear" });

  // Main submit flow delegating to flow.js
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    suggestions.hideSuggestions(); // ensure dropdown closed
    handleChatSubmit({
      text,
      sysEl: sys,
      useWebEl: useWeb,
      webProviderEl: webProvider,
      hideSuggestions: suggestions.hideSuggestions,
    });
  });
}
