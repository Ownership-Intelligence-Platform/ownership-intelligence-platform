// Layers orchestrator: fetch layers, render tree, then load related data
import { buildTreeFromPaths, renderTree } from "./tree.js";
import { loadRepresentatives } from "./representatives.js";
import { loadNews } from "./news.js";
import { resolveEntityInput } from "./utils.js";

/** Load ownership layers and then representatives + news for the root. */
export async function loadLayers() {
  const raw = document.getElementById("rootId").value.trim();
  const depth = Number(document.getElementById("depth").value || 2);
  if (!raw) {
    alert("Please enter a root entity id");
    return;
  }
  const rootId = await resolveEntityInput(raw);
  if (!rootId) return;
  document.getElementById("rootId").value = rootId;
  const treeEl = document.getElementById("layersTree");
  const statusEl = document.getElementById("status");
  statusEl.textContent = "Loading layers…";
  try {
    const res = await fetch(
      `/layers/${encodeURIComponent(rootId)}?depth=${depth}`
    );
    if (!res.ok) {
      const errText = await res.text();
      treeEl.textContent = `Failed to load layers (${res.status}): ${errText}`;
      statusEl.textContent = "";
      return;
    }
    const data = await res.json();
    const tree = buildTreeFromPaths(data);
    if (!tree) {
      treeEl.textContent = "No layers found for this root.";
    } else {
      renderTree(treeEl, tree, data?.root?.id);
    }
    await Promise.all([loadRepresentatives(rootId), loadNews(rootId)]);
  } catch (e) {
    treeEl.textContent = `Error: ${e}`;
  } finally {
    setTimeout(() => (statusEl.textContent = ""), 1500);
  }
}
