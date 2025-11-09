// List locations for a given entity and render grouped details.

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

export async function loadLocations(entityId) {
  const container = document.getElementById("locationsList");
  if (!container) return;
  try {
    setStatus("Loading locations…", 0);
    container.innerHTML = "Loading…";
    const url = `/entities/${encodeURIComponent(entityId)}/locations`;
    console.debug("[locations] fetch", url);
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
    const groups = data.groups || {
      registered: [],
      operating: [],
      offshore: [],
    };
    const buildList = (title, items) => `
      <div class="mb-2">
        <h4 class="font-semibold text-sm">${title}</h4>
        ${
          items.length
            ? `<ul class="list-disc ml-5">${items
                .map((i) => `<li>${i}</li>`)
                .join("")}</ul>`
            : '<div class="text-gray-500 dark:text-gray-400 text-xs">None</div>'
        }
      </div>`;
    container.innerHTML = h(`
      <div>
        ${buildList("Registered", groups.registered || [])}
        ${buildList("Operating", groups.operating || [])}
        ${buildList("Offshore", groups.offshore || [])}
      </div>
    `);
    setStatus("Locations loaded.");
  } catch (e) {
    container.innerHTML = `<span class=\"text-rose-600\">Failed to load locations: ${e}</span>`;
    setStatus(`Failed: ${e}`);
    console.error("[locations] error", e);
  }
}
