// List accounts for a given entity and render as a table.

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

export async function loadAccounts(entityId) {
  const container = document.getElementById("accountsList");
  if (!container) return;
  try {
    setStatus("Loading accounts…", 0);
    container.innerHTML = "Loading…";
    const res = await fetch(
      `/entities/${encodeURIComponent(entityId)}/accounts`
    );
    const data = await res.json();
    const items = data.items || [];
    if (!items.length) {
      container.innerHTML = "No accounts found.";
      setStatus("Accounts loaded.");
      return;
    }
    const rows = items
      .map(
        (a) => `
        <tr class="border-t border-gray-200 dark:border-gray-800">
          <td class="px-2 py-1">${a.account_number ?? ""}</td>
          <td class="px-2 py-1">${a.bank_name ?? ""}</td>
          <td class="px-2 py-1 text-right">${
            a.balance != null ? Number(a.balance).toLocaleString() : ""
          }</td>
        </tr>`
      )
      .join("");
    container.innerHTML = h(`
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left">
              <th class="px-2 py-1 font-semibold">Account #</th>
              <th class="px-2 py-1 font-semibold">Bank</th>
              <th class="px-2 py-1 font-semibold text-right">Balance</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
    setStatus("Accounts loaded.");
  } catch (e) {
    container.innerHTML = `<span class="text-rose-600">Failed to load accounts: ${e}</span>`;
    setStatus(`Failed: ${e}`);
  }
}
