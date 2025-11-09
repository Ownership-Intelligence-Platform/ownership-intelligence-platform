// List guarantees for a given entity and render as a table.

function setStatus(msg, timeout = 2000) {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = msg;
    if (timeout) setTimeout(() => (el.textContent = ""), timeout);
  }
}

function h(html) {
  return html;
}

export async function loadGuarantees(entityId, direction = "out") {
  const container = document.getElementById("guaranteesList");
  if (!container) return;
  try {
    setStatus("Loading guarantees…", 0);
    container.innerHTML = "Loading…";
    const params = new URLSearchParams({ direction });
    const url = `/entities/${encodeURIComponent(
      entityId
    )}/guarantees?${params.toString()}`;
    console.debug("[guarantees] fetch", url);
    const res = await fetch(url);
    let data;
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status}: ${(data && data.detail) || res.statusText}`
      );
    }
    const items = data.items || [];
    if (!items.length) {
      container.innerHTML = "No guarantees found.";
      setStatus("Guarantees loaded.");
      return;
    }
    const rows = items
      .map(
        (g) => `
        <tr class="border-t border-gray-200 dark:border-gray-800">
          <td class="px-2 py-1">${g.guarantor_id ?? ""}</td>
          <td class="px-2 py-1">${g.guaranteed_id ?? ""}</td>
          <td class="px-2 py-1 text-right">${
            g.amount != null ? Number(g.amount).toLocaleString() : ""
          }</td>
        </tr>`
      )
      .join("");
    container.innerHTML = h(`
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left">
              <th class="px-2 py-1 font-semibold">Guarantor</th>
              <th class="px-2 py-1 font-semibold">Guaranteed</th>
              <th class="px-2 py-1 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
    setStatus("Guarantees loaded.");
  } catch (e) {
    container.innerHTML = `<span class="text-rose-600">Failed to load guarantees: ${e}</span>`;
    setStatus(`Failed: ${e}`);
    console.error("[guarantees] error", e);
  }
}
