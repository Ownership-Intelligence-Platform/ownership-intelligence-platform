// chat/fastpaths.js
// Fast-path entity resolution helpers.
import { tryResolveEntityInput } from "../utils.js";
import { revealDashboard, loadFullDashboardAndSnapshot } from "./dashboard.js";
import { appendMessage } from "./conversation.js";
import { pushHistory } from "./state.js";

export async function resolveQuotedCandidate(text, targetList) {
  const m = text.match(/["“”'‘’]([^"“”'‘’]+)["“”'‘’]/);
  const candidate = m ? m[1].trim() : null;
  if (!candidate) return { handled: false, candidate: null };
  try {
    const entityId = await tryResolveEntityInput(candidate);
    if (!entityId) return { handled: false, candidate };
    const root = document.getElementById("rootId");
    if (root) root.value = entityId;
    const initRoot = document.getElementById("initialRootId");
    if (initRoot) initRoot.value = entityId;
    revealDashboard();
    await loadFullDashboardAndSnapshot(entityId, candidate, "Dashboard 快照");
    appendMessage(
      "assistant",
      `Found internal entity and loaded its details: [${entityId}].`,
      targetList
    );
    pushHistory(
      "assistant",
      `Found internal entity and loaded its details: [${entityId}].`
    );
    return { handled: true, candidate };
  } catch (_) {
    return { handled: false, candidate };
  }
}

export async function resolveWholeInput(text, targetList) {
  try {
    const entityId2 = await tryResolveEntityInput(text);
    if (!entityId2) return false;
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
    return true;
  } catch (_) {
    return false;
  }
}
