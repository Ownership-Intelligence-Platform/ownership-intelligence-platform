// List employment SERVES_AS relationships for a given entity and render as a table.

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

export async function loadEmployment(entityId, role = "both") {
  const container = document.getElementById("employmentList");
  if (!container) return;
  try {
    setStatus("Loading employment…", 0);
    container.innerHTML = "Loading…";
    const params = new URLSearchParams({ role });
    const url = `/entities/${encodeURIComponent(
      entityId
    )}/employment?${params.toString()}`;
    console.debug("[employment] fetch", url);
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
      container.innerHTML = "No employment relations found.";
      setStatus("Employment loaded.");
      return;
    }
    const rows = items
      .map(
        (e) => `
        <tr class="border-t border-gray-200 dark:border-gray-800">
          <td class="px-2 py-1">${e.person_id ?? ""}</td>
          <td class="px-2 py-1">${e.company_id ?? ""}</td>
          <td class="px-2 py-1">${e.role ?? ""}</td>
        </tr>`
      )
      .join("");
    container.innerHTML = h(`
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left">
              <th class="px-2 py-1 font-semibold">Person</th>
              <th class="px-2 py-1 font-semibold">Company</th>
              <th class="px-2 py-1 font-semibold">Role</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
    setStatus("Employment loaded.");
  } catch (e) {
    container.innerHTML = `<span class="text-rose-600">Failed to load employment: ${e}</span>`;
    setStatus(`Failed: ${e}`);
    console.error("[employment] error", e);
  }
}
