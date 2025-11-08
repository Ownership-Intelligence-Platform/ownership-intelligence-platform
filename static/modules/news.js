// News loading

/** Fetch and render news for an entity. */
export async function loadNews(entityId) {
  const el = document.getElementById("newsList");
  const limit = Number(document.getElementById("newsLimit").value || 5);
  el.textContent = "Loading news…";
  try {
    const res = await fetch(
      `/entities/${encodeURIComponent(entityId)}/news?limit=${limit}`
    );
    if (!res.ok) {
      const txt = await res.text();
      el.textContent = `Failed to load news: ${res.status} ${txt}`;
      return;
    }
    const data = await res.json();
    const items = (data && data.items) || [];
    if (!items.length) {
      el.textContent = "No recent news found.";
      return;
    }
    const metaLine = document.createElement("div");
    metaLine.className = "muted";
    metaLine.style.marginBottom = "4px";
    metaLine.textContent = `Showing ${items.length} (stored: ${
      data.stored_count || 0
    }, external: ${data.external_count || 0})`;

    const frag = document.createDocumentFragment();
    frag.appendChild(metaLine);
    const ul = document.createElement("ul");
    items.forEach((n) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = n.url || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = n.title || "(untitled)";
      li.appendChild(a);

      const meta = [];
      if (n.source) meta.push(n.source);
      if (n.published_at) meta.push(String(n.published_at).slice(0, 19));
      if (meta.length) {
        const span = document.createElement("span");
        span.className = "muted";
        span.style.marginLeft = "6px";
        span.textContent = `— ${meta.join(" · ")}`;
        li.appendChild(span);
      }
      if (n.summary) {
        const d = document.createElement("div");
        d.className = "muted";
        d.style.marginTop = "2px";
        d.textContent = n.summary;
        li.appendChild(d);
      }
      if (n.stored) {
        const badge = document.createElement("span");
        badge.textContent = " stored";
        badge.style.background = "#ffd54f";
        badge.style.color = "#553";
        badge.style.fontSize = "0.7rem";
        badge.style.padding = "2px 4px";
        badge.style.borderRadius = "4px";
        badge.style.marginLeft = "6px";
        li.appendChild(badge);
      }
      ul.appendChild(li);
    });
    frag.appendChild(ul);
    el.innerHTML = "";
    el.appendChild(frag);
  } catch (e) {
    el.textContent = `Error loading news: ${e}`;
  }
}
