// List transactions for a given entity and render as a table.

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

export async function loadTransactions(entityId, direction = "out") {
  const container = document.getElementById("transactionsList");
  if (!container) return;
  try {
    setStatus("Loading transactions…", 0);
    container.innerHTML = "Loading…";
    const params = new URLSearchParams({ direction });
    const res = await fetch(
      `/entities/${encodeURIComponent(
        entityId
      )}/transactions?${params.toString()}`
    );
    const data = await res.json();
    const items = data.items || [];
    if (!items.length) {
      container.innerHTML = "No transactions found.";
      setStatus("Transactions loaded.");
      return;
    }
    const rows = items
      .map(
        (t) => `
        <tr class="border-t border-gray-200 dark:border-gray-800">
          <td class="px-2 py-1">${t.from_id ?? ""}</td>
          <td class="px-2 py-1">${t.to_id ?? ""}</td>
          <td class="px-2 py-1 text-right">${
            t.amount != null ? Number(t.amount).toLocaleString() : ""
          }</td>
          <td class="px-2 py-1">${t.time ?? ""}</td>
          <td class="px-2 py-1">${t.type ?? ""}</td>
          <td class="px-2 py-1">${t.channel ?? ""}</td>
        </tr>`
      )
      .join("");
    container.innerHTML = h(`
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left">
              <th class="px-2 py-1 font-semibold">From</th>
              <th class="px-2 py-1 font-semibold">To</th>
              <th class="px-2 py-1 font-semibold text-right">Amount</th>
              <th class="px-2 py-1 font-semibold">Time</th>
              <th class="px-2 py-1 font-semibold">Type</th>
              <th class="px-2 py-1 font-semibold">Channel</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
    setStatus("Transactions loaded.");
  } catch (e) {
    container.innerHTML = `<span class="text-rose-600">Failed to load transactions: ${e}</span>`;
    setStatus(`Failed: ${e}`);
  }
}
