// News loading

/**
 * Minimal HTML sanitizer for news summaries.
 * Allows a safe subset of tags/attributes and fixes <a> targets.
 */
function sanitizeSummary(html) {
  if (!html) return "";
  const allowedTags = new Set([
    "A",
    "B",
    "STRONG",
    "EM",
    "I",
    "U",
    "BR",
    "P",
    "SPAN",
    "FONT",
  ]);
  const allowedAttrs = {
    A: new Set(["href", "target", "rel"]),
    FONT: new Set(["color"]),
    SPAN: new Set([]),
    DEFAULT: new Set([]),
  };

  const wrapper = document.createElement("div");
  // Assigning to innerHTML will create a DOM we can traverse and sanitize.
  wrapper.innerHTML = String(html);

  const walk = (node) => {
    switch (node.nodeType) {
      case Node.ELEMENT_NODE: {
        // Drop disallowed elements but keep their text/children (unwrap)
        if (!allowedTags.has(node.tagName)) {
          const parent = node.parentNode;
          if (parent) {
            while (node.firstChild) parent.insertBefore(node.firstChild, node);
            parent.removeChild(node);
          }
          return;
        }

        // Strip non-allowed attributes
        const allowed = allowedAttrs[node.tagName] || allowedAttrs.DEFAULT;
        // Clone array because attributes is live
        Array.from(node.attributes).forEach((attr) => {
          const name = attr.name.toLowerCase();
          if (!allowed.has(name)) node.removeAttribute(attr.name);
        });

        // Additional hardening for anchors
        if (node.tagName === "A") {
          let href = node.getAttribute("href") || "#";
          try {
            const u = new URL(href, window.location.href);
            if (!/^https?:$/.test(u.protocol)) href = "#";
          } catch (_) {
            href = "#";
          }
          node.setAttribute("href", href);
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        }

        // Limit FONT color to simple hex or named colors
        if (node.tagName === "FONT") {
          const color = node.getAttribute("color");
          if (
            color &&
            !/^#[0-9a-fA-F]{3,6}$/.test(color) &&
            !/^[a-zA-Z]+$/.test(color)
          ) {
            node.removeAttribute("color");
          }
        }
        break;
      }
      case Node.COMMENT_NODE: {
        node.remove();
        return;
      }
      default:
        break;
    }

    // Recurse children (snapshot to avoid live collection issues)
    Array.from(node.childNodes).forEach(walk);
  };

  Array.from(wrapper.childNodes).forEach(walk);
  return wrapper.innerHTML;
}

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
        // Render limited, sanitized HTML so source-provided links are clickable
        d.innerHTML = sanitizeSummary(n.summary);
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
