// chat/postReply.js
// Processes LLM reply effects: person resolver, dashboard hints, entity chips, sources.
import { triggerDashboardIntents, getDashboardMatches } from "./intents.js";
import { createDashboardHintCard, appendMessage } from "./conversation.js";
import {
  extractEntityIds,
  attachIdChipsBelowLastAssistant,
} from "./entitiesHelper.js";
import { revealDashboard, loadFullDashboardAndSnapshot } from "./dashboard.js";
import { renderPersonResolverCard } from "./personResolverCard.js";

export async function processReply({ data, reply, candidate, targetList }) {
  const list = targetList || document.getElementById("chatMessages");

  // Person resolver card
  if (data.person_resolver && Array.isArray(data.person_resolver.candidates)) {
    try {
      renderPersonResolverCard(
        candidate,
        data.person_resolver.candidates,
        list
      );
    } catch (e) {
      console.error("Failed to render person resolver card", e);
    }
  }

  // Dashboard intent hints
  const matches = getDashboardMatches(reply);
  if (matches.length) {
    createDashboardHintCard(matches);
    triggerDashboardIntents(reply);
  }

  // Extract entity IDs
  const ids = extractEntityIds(reply);
  if (ids.length) {
    attachIdChipsBelowLastAssistant(ids, list);
    const first = ids[0];
    const root = document.getElementById("rootId");
    if (root) root.value = first;
    revealDashboard();
    await loadFullDashboardAndSnapshot(first, first, "Dashboard 快照");
  }

  // Sources list
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
    list?.appendChild(container);
  }
}
