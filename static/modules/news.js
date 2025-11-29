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
  // LocalStorage switch: set `mockNews` to "true" to enable mock data in the browser.
  // Example (in browser console):
  //   localStorage.setItem('mockNews', 'true')
  // To disable:
  //   localStorage.removeItem('mockNews')
  const mockEnabled = (function () {
    try {
      return localStorage.getItem("mockNews") === "true";
    } catch (e) {
      return false;
    }
  })();

  // Small helper to generate deterministic mock items based on the provided entityId/name
  function generateMockNews(id, limit) {
    // Try to derive a human-friendly display name from common inputs on the page.
    // If the user searched for a person name (e.g., in personName, rootId or personId), prefer that.
    const rawFromDom = (function () {
      try {
        const byId = (id) => document.getElementById(id)?.value?.trim();
        return byId("personName") || byId("rootId") || byId("personId") || "";
      } catch (e) {
        return "";
      }
    })();
    // If rawFromDom looks like a real name (contains CJK characters), use it; otherwise fall back to id
    const looksLikeChineseName = /[\u4e00-\u9fff]/.test(rawFromDom || "");
    const nameHint = (
      looksLikeChineseName ? rawFromDom : String(id || "目标")
    ).slice(0, 24);

    // If this looks like a person (id starts with P or rawFromDom contains a name), use person-focused templates
    const isPerson = /^P/i.test(String(id)) || looksLikeChineseName;
    const sources = ["财新网", "澎湃新闻", "界面新闻", "证券时报", "新京报"];

    let base = [];
    if (isPerson) {
      base = [
        {
          title: `成都宏远贸易有限公司2024远景规划`,
          url: "#",
          source: sources[0],
          published_at: new Date().toISOString(),
          summary: `李辉近期在多次公开场合提及其对成都宏远贸易有限公司未来发展的规划，强调创新与市场拓展的重要性。`,
          stored: true,
        },
        {
          title: `成都宏远贸易李辉总经理春节致辞`,
          url: "#",
          source: sources[1],
          published_at: new Date(Date.now() - 3600 * 1000).toISOString(),
          summary: `在新春佳节来临之际，李辉总经理发表致辞，感谢员工的辛勤付出，并展望公司在新的一年的发展方向。`,
          stored: false,
        },
        {
          title: `成都宏远贸易有限公司李辉出席行业峰会`,
          url: "#",
          source: sources[2],
          published_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          summary: `李辉在行业峰会上分享了成都宏远贸易有限公司的最新发展成果和未来战略规划，获得广泛关注。`,
          stored: true,
        },
        {
          title: `李辉荣获“年度杰出企业家”称号`,
          url: "#",
          source: sources[1],
          published_at: new Date(Date.now() - 3600 * 1000).toISOString(),
          summary: `李辉荣获“年度杰出企业家”称号，表彰其在企业管理和社会责任方面的卓越贡献。`,
          stored: false,
        },
        {
          title: `李辉出席国际贸易论坛并发表演讲`,
          url: "#",
          source: sources[2],
          published_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          summary: `李辉在国际贸易论坛上发表了关于全球贸易趋势的演讲，强调了创新和合作的重要性。`,
          stored: true,
        },
      ];
    } else {
      // fallback company-like templates
      base = [
        {
          title: `${nameHint} 关联企业信息披露引关注`,
          url: "#",
          source: sources[0],
          published_at: new Date().toISOString(),
          summary: `${nameHint} 与关联公司的股权和任职信息被媒体整理，部分细节以工商登记与企业披露为准。`,
          stored: true,
        },
        {
          title: `媒体：${nameHint} 关联企业被列入核查范围`,
          url: "#",
          source: sources[1],
          published_at: new Date(Date.now() - 3600 * 1000).toISOString(),
          summary: `多家媒体报道关注 ${nameHint} 相关主体的经营与信息披露情况，正在进一步核实相关公告与公开记录。`,
          stored: false,
        },
        {
          title: `${nameHint} 出任多家企业管理职务`,
          url: "#",
          source: sources[2],
          published_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          summary: `公开资料显示 ${nameHint} 在若干企业担任高管或法定代表人，具体履历以企业年报与工商信息为准。`,
          stored: true,
        },
      ];
    }

    // Repeat base to reach requested limit while keeping main content the same
    const out = [];
    for (let i = 0; i < limit; i++) {
      const item = Object.assign({}, base[i % base.length]);
      // Make small dynamic variation per index so items look distinct
      item.title = item.title + (i > 0 ? ` （#${i + 1})` : "");
      // Slightly tweak published time so list appears ordered
      item.published_at = new Date(Date.now() - i * 3600 * 1000).toISOString();
      // Attach person name and make link look real (search link)
      item.person_name = nameHint;
      item.url = `https://example.com/search?q=${encodeURIComponent(
        nameHint
      )}&item=${i + 1}`;
      // Generate deterministic mock risk / confidence
      const h =
        Array.from(String(id) + i).reduce((s, c) => s + c.charCodeAt(0), 0) %
          100 || 42;
      const riskLevels = ["Low", "Medium", "High"];
      // If summary hints at government background, bias risk upward
      if (/政府|国有|任职/.test(item.summary)) {
        item.risk = "High";
        item.confidence = 80 + (h % 20); // 80-99
      } else {
        item.confidence = 60 + (h % 41); // 60-100
        item.risk = riskLevels[h % riskLevels.length];
      }
      out.push(item);
    }
    return {
      items: out,
      stored_count: out.filter((x) => x.stored).length,
      external_count: out.length - out.filter((x) => x.stored).length,
    };
  }
  const el = document.getElementById("newsList");
  const limit = Number(document.getElementById("newsLimit").value || 5);
  console.log("[news] loadNews start", { entityId, limit });
  el.textContent = "Loading news…";
  try {
    if (mockEnabled) {
      // Use mock data path (no network). Mock is slightly personalized by entityId.
      const data = generateMockNews(entityId, limit);
      const items = data.items || [];
      if (!items.length) {
        el.textContent = "No recent news found.";
        return;
      }
      const metaLine = document.createElement("div");
      metaLine.className = "muted";
      metaLine.style.marginBottom = "4px";
      // Do NOT label as mocked in UI — present like real news counts
      metaLine.textContent = `Showing ${items.length} (stored: ${
        data.stored_count || 0
      }, external: ${data.external_count || 0})`;

      const frag = document.createDocumentFragment();
      frag.appendChild(metaLine);
      const ul = document.createElement("ul");
      items.forEach((n, idx) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = n.url || "#";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        // Show numbering and person name in title
        a.textContent = `${idx + 1}. ${n.person_name || entityId} — ${
          n.title || "(untitled)"
        }`;
        li.appendChild(a);

        // risk & confidence badges (mocked)
        if (n.risk || n.confidence) {
          const badges = document.createElement("span");
          badges.style.marginLeft = "8px";
          if (n.risk) {
            const rb = document.createElement("span");
            rb.textContent = ` ${n.risk}`;
            rb.style.background =
              n.risk === "High"
                ? "#f87171"
                : n.risk === "Medium"
                ? "#f59e0b"
                : "#86efac";
            rb.style.color = "#102a12";
            rb.style.fontSize = "0.7rem";
            rb.style.padding = "2px 6px";
            rb.style.borderRadius = "999px";
            rb.style.marginLeft = "6px";
            badges.appendChild(rb);
          }
          if (n.confidence) {
            const cb = document.createElement("span");
            cb.textContent = ` ${n.confidence}%`;
            cb.style.background = "#e5e7eb";
            cb.style.color = "#111827";
            cb.style.fontSize = "0.7rem";
            cb.style.padding = "2px 6px";
            cb.style.borderRadius = "999px";
            cb.style.marginLeft = "6px";
            badges.appendChild(cb);
          }
          li.appendChild(badges);
        }

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
      return;
    }
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
