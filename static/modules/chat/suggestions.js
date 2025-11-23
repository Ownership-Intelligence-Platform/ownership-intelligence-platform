// chat/suggestions.js
// Encapsulates fuzzy entity suggestion dropdown logic.
import { tryResolveEntityInput } from "../utils.js";
import { revealDashboard, loadFullDashboardAndSnapshot } from "./dashboard.js";

// setupSuggestions wires suggestion dropdown behavior for a given form & input.
// onSelect(entityId) is invoked after successful internal resolution.
export function setupSuggestions({
  form,
  input,
  onSelect,
  setLastConversationTall,
}) {
  let suggestionBox = null;
  let lastSuggestQuery = "";
  let pendingSuggestAbort = null;
  const DEBOUNCE_MS = 250;
  let timer = null;
  let isComposing = false;

  function ensureBox() {
    if (suggestionBox) return suggestionBox;
    suggestionBox = document.createElement("div");
    suggestionBox.id = "chatSuggestions";
    suggestionBox.className =
      "absolute left-3 right-28 top-full mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow text-sm max-h-60 overflow-y-auto z-50 hidden";
    form.classList.add("relative");
    form.appendChild(suggestionBox);
    document.addEventListener("click", (e) => {
      if (!suggestionBox) return;
      if (suggestionBox.contains(e.target) || e.target === input) return;
      hideSuggestions();
    });
    return suggestionBox;
  }

  function hideSuggestions() {
    if (suggestionBox) suggestionBox.classList.add("hidden");
    setLastConversationTall && setLastConversationTall(false);
  }

  async function fetchSuggestions(q) {
    const query = (q || "").trim();
    if (!query || query.length < 2) return hideSuggestions();
    if (query === lastSuggestQuery) return; // skip redundant
    lastSuggestQuery = query;
    if (pendingSuggestAbort) pendingSuggestAbort.abort();
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
      // silent
    }
  }

  function scheduleFetch() {
    if (isComposing) return;
    if (timer) clearTimeout(timer);
    const val = input.value;
    timer = setTimeout(() => fetchSuggestions(val), DEBOUNCE_MS);
  }

  function renderSuggestions(items, query) {
    const box = ensureBox();
    box.innerHTML = "";
    if (!items.length) return hideSuggestions();
    items.forEach((it) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className =
        "block w-full text-left px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 border-b last:border-b-0 border-gray-100 dark:border-gray-800";
      const type = it.type ? ` · ${it.type}` : "";
      const score = it.score != null ? ` (score=${it.score})` : "";
      const name = it.name || it.id || "";
      const nameLower = name.toLowerCase();
      const qLower = (query || "").toLowerCase();
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
        input.value = it.id;
        hideSuggestions();
        input.focus();
        try {
          const entityId = await tryResolveEntityInput(it.id);
          if (!entityId) return;
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
          setLastConversationTall && setLastConversationTall(false);
          onSelect && onSelect(entityId);
        } catch (_) {}
      });
      box.appendChild(row);
    });
    box.classList.remove("hidden");
  }

  // IME composition tracking
  input.addEventListener("compositionstart", () => {
    isComposing = true;
  });
  input.addEventListener("compositionend", () => {
    isComposing = false;
    scheduleFetch();
  });
  input.addEventListener("input", scheduleFetch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideSuggestions();
  });

  return { hideSuggestions, scheduleSuggestionFetch: scheduleFetch };
}
