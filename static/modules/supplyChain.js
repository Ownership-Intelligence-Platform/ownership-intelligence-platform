// List supply chain relationships for a given entity and render as a table.

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

export async function loadSupplyChain(entityId, direction = "out") {
  const container = document.getElementById("supplyChainList");
  if (!container) return;
  try {
    setStatus("Loading supply chain…", 0);
    container.innerHTML = "Loading…";
    const params = new URLSearchParams({ direction });
    const url = `/entities/${encodeURIComponent(
      entityId
    )}/supply-chain?${params.toString()}`;
    console.debug("[supplyChain] fetch", url);
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
      container.innerHTML = "No supply chain links found.";
      setStatus("Supply chain loaded.");
      return;
    }
    const rows = items
      .map(
        (s) => `
        <tr class="border-t border-gray-200 dark:border-gray-800">
          <td class="px-2 py-1">${s.supplier_id ?? ""}</td>
          <td class="px-2 py-1">${s.customer_id ?? ""}</td>
          <td class="px-2 py-1 text-right">${
            s.frequency != null ? Number(s.frequency).toLocaleString() : ""
          }</td>
        </tr>`
      )
      .join("");
    container.innerHTML = h(`
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left">
              <th class="px-2 py-1 font-semibold">Supplier</th>
              <th class="px-2 py-1 font-semibold">Customer</th>
              <th class="px-2 py-1 font-semibold text-right">Frequency</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
    setStatus("Supply chain loaded.");
  } catch (e) {
    container.innerHTML = `<span class="text-rose-600">Failed to load supply chain: ${e}</span>`;
    setStatus(`Failed: ${e}`);
    console.error("[supplyChain] error", e);
  }
}
