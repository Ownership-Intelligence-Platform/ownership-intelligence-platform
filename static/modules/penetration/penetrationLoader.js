// Loader that fetches penetration + layers, then renders the graph
import { buildGraphFromLayersAndPenetration } from "./graphBuilder.js";
import { renderPenetrationGraph } from "./graphRenderer.js";

/** High-level loader: fetch penetration + layers, then render graph. */
export async function loadPenetration() {
  const raw = document.getElementById("rootId").value.trim();
  const depth = Number(document.getElementById("depth").value || 3);
  const includePaths = !!document.getElementById("includePaths")?.checked;
  const maxPaths = Number(document.getElementById("maxPaths")?.value || 3);
  if (!raw) {
    alert("Please enter a root entity id");
    return;
  }
  // Lazy import to avoid circular deps at module load time
  const { resolveEntityInput } = await import("../utils.js");
  const rootId = await resolveEntityInput(raw);
  if (!rootId) return;
  document.getElementById("rootId").value = rootId;
  const statusEl = document.getElementById("status");
  statusEl.textContent = "Loading penetration…";
  try {
    const [penRes, layersRes] = await Promise.all([
      fetch(
        `/penetration/${encodeURIComponent(
          rootId
        )}?depth=${depth}&include_paths=${includePaths}&max_paths=${maxPaths}`
      ),
      fetch(`/layers/${encodeURIComponent(rootId)}?depth=${depth}`),
    ]);
    if (!penRes.ok) {
      const txt = await penRes.text();
      document.getElementById(
        "penetrationChart"
      ).textContent = `Failed to load penetration: ${penRes.status} ${txt}`;
      statusEl.textContent = "";
      return;
    }
    if (!layersRes.ok) {
      const txt = await layersRes.text();
      document.getElementById(
        "penetrationChart"
      ).textContent = `Failed to load layers: ${layersRes.status} ${txt}`;
      statusEl.textContent = "";
      return;
    }
    const penData = await penRes.json();
    const layersData = await layersRes.json();
    const graph = buildGraphFromLayersAndPenetration(layersData, penData);
    renderPenetrationGraph(graph, penData?.root);
  } catch (e) {
    document.getElementById("penetrationChart").textContent = `Error: ${e}`;
  } finally {
    setTimeout(() => (statusEl.textContent = ""), 1500);
  }
}
