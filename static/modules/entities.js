// Entity module: fetch and render basic entity info including description
export async function loadEntityInfo(entityId) {
  const panel = document.getElementById("entityInfo");
  if (!panel) return;
  panel.textContent = "Loading entity info…";
  try {
    const res = await fetch(`/entities/${encodeURIComponent(entityId)}`);
    if (!res.ok) {
      panel.textContent = `Failed to load entity info (${res.status})`;
      return;
    }
    const ent = await res.json();
    panel.innerHTML = renderEntity(ent);
  } catch (e) {
    panel.textContent = `Error: ${e}`;
  }
}

function escapeHtml(s) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderEntity(ent) {
  const id = escapeHtml(ent.id);
  const name = escapeHtml(ent.name || "(unnamed)");
  const type = escapeHtml(ent.type || "");
  const desc = escapeHtml(ent.description || "No description available.");
  return `
    <div class="space-y-2">
      <div class="text-sm text-gray-600 dark:text-gray-300">ID: <code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">${id}</code></div>
      <div class="text-base font-semibold">${name}${
    type
      ? ` <span class=\"text-xs font-normal text-gray-500 dark:text-gray-400\">(${type})</span>`
      : ""
  }</div>
      <div class="mt-2">
        <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Description</div>
        <div class="whitespace-pre-wrap text-gray-700 dark:text-gray-200">${desc}</div>
      </div>
    </div>
  `;
}
