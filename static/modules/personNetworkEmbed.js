// Lightweight embed for person relationship network on the homepage
// Exports: loadPersonNetwork(personId, containers)

async function fetchNetwork(personId) {
  const res = await fetch(`/person-network/${encodeURIComponent(personId)}`);
  if (!res.ok) throw new Error(`Failed to fetch person network: ${res.status}`);
  return res.json();
}

function renderRelationsCard(container, data) {
  if (!container) return;
  const id2name = new Map(
    (data.nodes || []).map((n) => [n.id, n.name || n.id])
  );
  const cats = computeCategories(data, data.person?.id);
  const items = [
    { key: "parents", label: "父母" },
    { key: "children", label: "子女" },
    { key: "spouses", label: "配偶" },
    { key: "friends", label: "朋友" },
    { key: "classmates", label: "同学" },
    { key: "colleagues", label: "同事" },
  ];
  const html = items
    .map((it) => {
      const ids = cats.list[it.key] || [];
      const count = ids.length;
      const chips = ids
        .slice(0, 6)
        .map((pid) => {
          const name = id2name.get(pid) || pid;
          const title = `${name} (${pid})`;
          return `<span class="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs" title="${escapeHtml(
            title
          )}">${escapeHtml(name)}</span>`;
        })
        .join(" ");
      return `
      <div class="rounded border border-gray-200 dark:border-gray-800 p-3">
        <div class="text-xs text-gray-500 mb-1">${it.label}</div>
        <div class="text-xl font-semibold">${count}</div>
        <div class="mt-2 flex flex-wrap gap-1">${
          chips || `<span class='text-gray-400 text-xs'>暂无</span>`
        }</div>
      </div>`;
    })
    .join("");
  container.innerHTML = html;
}

function computeCategories(data, focalId) {
  if (data.summary) {
    const list = buildListFromLinks(data.links || [], focalId);
    return { counts: data.summary, list };
  }
  const list = buildListFromLinks(data.links || [], focalId);
  const counts = Object.fromEntries(
    Object.entries(list).map(([k, arr]) => [k, arr.length])
  );
  return { counts, list };
}

function buildListFromLinks(links, focalId) {
  const out = {
    parents: new Set(),
    children: new Set(),
    spouses: new Set(),
    friends: new Set(),
    classmates: new Set(),
    colleagues: new Set(),
  };
  for (const e of links) {
    const t = (e.type || "").toUpperCase();
    const s = e.source;
    const tgt = e.target;
    if (t === "PARENT_OF") {
      if (tgt === focalId) out.parents.add(s);
      else if (s === focalId) out.children.add(tgt);
    } else if (t === "CHILD_OF") {
      if (s === focalId) out.parents.add(tgt);
      else if (tgt === focalId) out.children.add(s);
    } else if (t === "SPOUSE_OF") {
      const other = s === focalId ? tgt : tgt === focalId ? s : null;
      if (other) out.spouses.add(other);
    } else if (t === "FRIEND_OF") {
      const other = s === focalId ? tgt : tgt === focalId ? s : null;
      if (other) out.friends.add(other);
    } else if (t === "CLASSMATE_OF") {
      const other = s === focalId ? tgt : tgt === focalId ? s : null;
      if (other) out.classmates.add(other);
    } else if (t === "SHARE_COMPANY") {
      const other = s === focalId ? tgt : tgt === focalId ? s : null;
      if (other) out.colleagues.add(other);
    }
  }
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, Array.from(v)])
  );
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderGraph(container, data) {
  container.innerHTML = "";
  // When rendering into hidden panels (display:none), clientWidth/Height can be 0.
  // Use bounding rect with sensible fallbacks to ensure a visible chart in snapshots.
  // Compute width/height with sensible minimums. Prefer the actual
  // bounding rect so the SVG can fill its parent. We'll also attach a
  // ResizeObserver to keep the simulation centered on size changes.
  const rect = container.getBoundingClientRect();
  const width = Math.max(480, rect.width || container.clientWidth || 640);
  const height = Math.max(280, rect.height || container.clientHeight || 420);

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", width)
    .attr("height", height)
    // Make the SVG scale to fill its parent container while preserving
    // aspect and keeping the visual centered.
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  // Prevent default touch-action to allow pointer/touch dragging inside the SVG
  try {
    svg.style("touch-action", "none");
  } catch (_) {}

  const color = (d) => {
    if (d.id === data.person.id) return "#1d4ed8"; // focal
    if ((d.type || "").toLowerCase() === "company") return "#374151";
    return "#6366f1";
  };

  const linkColor = (d) => {
    switch (d.type) {
      case "LEGAL_REP":
        return "#2563eb";
      case "SERVES_AS":
        return "#059669";
      case "SHARE_COMPANY":
        return "#6b7280";
      default:
        return "#9ca3af";
    }
  };

  // Human-friendly labels for link types (falls back to raw type)
  function linkLabelText(type) {
    if (!type) return "";
    const t = String(type || "").toUpperCase();
    const map = {
      LEGAL_REP: "法定代表",
      SERVES_AS: "任职",
      SHARE_COMPANY: "同公司",
      FRIEND_OF: "朋友",
      SPOUSE_OF: "配偶",
      PARENT_OF: "父母/子女",
      CHILD_OF: "父母/子女",
      CLASSMATE_OF: "同学",
    };
    return map[t] || type.replace(/_/g, " ");
  }

  let links = (data.links || []).map((l) => ({ ...l }));
  // Deduplicate nodes by id (server should do this, but guard here)
  const nodesRaw = (data.nodes || []).map((n) => ({ ...n }));
  const nodeMapLocal = new Map();
  for (const n of nodesRaw) {
    if (!n || !n.id) continue;
    if (!nodeMapLocal.has(n.id)) nodeMapLocal.set(n.id, n);
    else {
      // Merge missing fields if any
      const ex = nodeMapLocal.get(n.id);
      nodeMapLocal.set(n.id, { ...n, ...ex });
    }
  }
  let nodes = Array.from(nodeMapLocal.values());

  // Filter links to existing nodes and normalize keys to 'source'/'target'
  links = links.filter(
    (l) =>
      l &&
      l.source &&
      l.target &&
      nodeMapLocal.has(l.source) &&
      nodeMapLocal.has(l.target)
  );

  // Ensure nodes have initial positions so they don't all collapse to (0,0)
  const cx = width / 2;
  const cy = height / 2;
  for (const n of nodes) {
    // Spread nodes across the available area to avoid left/top clustering.
    if (typeof n.x !== "number") n.x = Math.random() * width;
    if (typeof n.y !== "number") n.y = Math.random() * height;
  }

  console.log("[personNetwork] renderGraph nodes/links", {
    nodes: nodes.length,
    links: links.length,
  });

  // Create forces with parameters that scale with the container size so
  // the layout adapts to different viewport sizes.
  const baseDist = Math.max(120, Math.min(width, height) * 0.22);
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(() => baseDist)
    )
    .force(
      "charge",
      d3.forceManyBody().strength(-Math.max(200, Math.min(width, height) * 0.6))
    )
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force(
      "collide",
      d3.forceCollide().radius(Math.max(28, Math.min(width, height) * 0.065))
    );

  // Kickstart the simulation to ensure nodes spread out immediately
  simulation.alpha(1).restart();

  const link = svg
    .append("g")
    .attr("stroke-width", 1.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", linkColor)
    .attr("stroke-opacity", 0.8);

  // Labels for links: show relationship type above the link line
  const linkLabel = svg
    .append("g")
    .attr("class", "link-labels")
    .selectAll("text")
    .data(links)
    .join("text")
    .attr("font-size", 10)
    .attr("fill", "#374151")
    .attr("text-anchor", "middle")
    .attr("pointer-events", "none")
    .style("font-family", "sans-serif")
    // increase readability by painting a white stroke behind the glyphs
    .style("paint-order", "stroke")
    .style("stroke", "white")
    .style("stroke-width", 3)
    .text((d) => linkLabelText(d.type || d.label || ""));

  const dragBehavior = d3
    .drag()
    // Ensure the drag library interprets coordinates relative to the SVG element
    .container(function () {
      return svg.node();
    })
    .on("start", (event) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    })
    .on("drag", (event) => {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    })
    .on("end", (event) => {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    });

  const node = svg
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(dragBehavior);

  // Ensure groups accept pointer events and text doesn't block pointer capture
  try {
    node.style("pointer-events", "all");
    node.selectAll("text").style("pointer-events", "none");
  } catch (_) {}

  node
    .filter((d) => (d.type || "").toLowerCase() === "company")
    .append("rect")
    .attr("x", -14)
    .attr("y", -14)
    .attr("width", 28)
    .attr("height", 28)
    .attr("rx", 6)
    .attr("fill", color)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5);

  node
    .filter((d) => (d.type || "").toLowerCase() !== "company")
    .append("circle")
    .attr("r", 16)
    .attr("fill", color)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5);

  node
    .append("text")
    .text((d) => d.name || d.id)
    .attr("x", 20)
    .attr("y", 3)
    .attr("font-size", 10)
    .attr("fill", "#111827")
    .attr("paint-order", "stroke")
    .attr("stroke", "white")
    .attr("stroke-width", 3)
    .attr("stroke-linejoin", "round");

  // Add native tooltip for disambiguation (shows Name (ID) on hover)
  node.append("title").text((d) => `${d.name || d.id} (${d.id})`);

  // Improve drag cursor / UX
  node.style("cursor", "grab");

  // Keep a reference so resize handler can update forces and svg size
  let resizeObserver = null;
  const setupResize = () => {
    if (typeof ResizeObserver === "undefined") return;
    if (resizeObserver) return; // already attached
    resizeObserver = new ResizeObserver((entries) => {
      for (const ent of entries) {
        try {
          const r = ent.contentRect || ent.target.getBoundingClientRect();
          const w = Math.max(320, Math.floor(r.width || width));
          const h = Math.max(200, Math.floor(r.height || height));
          // update svg viewBox/size
          svg.attr("viewBox", [0, 0, w, h]);
          svg.attr("width", w).attr("height", h);
          // update center and collision/link distances
          const center = d3.forceCenter(w / 2, h / 2);
          simulation.force("center", center);
          simulation
            .force("link")
            .distance(Math.max(100, Math.min(w, h) * 0.2));
          simulation.force(
            "collide",
            d3.forceCollide().radius(Math.max(24, Math.min(w, h) * 0.06))
          );
          // nudge the simulation to re-heat and re-layout
          simulation.alpha(0.4).restart();
        } catch (e) {
          // ignore
        }
      }
    });
    try {
      resizeObserver.observe(container);
    } catch (e) {
      // ignore attach errors
    }
  };

  setupResize();

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);

    // Position link labels at the midpoint of the link with a small
    // perpendicular offset so they appear above the line.
    try {
      linkLabel
        .attr("x", (d) => {
          const sx = d.source.x;
          const sy = d.source.y;
          const tx = d.target.x;
          const ty = d.target.y;
          const mx = (sx + tx) / 2;
          const my = (sy + ty) / 2;
          const dx = tx - sx;
          const dy = ty - sy;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len; // perpendicular normal
          const offset = Math.min(18, Math.max(8, Math.hypot(dx, dy) * 0.06));
          return mx + nx * offset;
        })
        .attr("y", (d) => {
          const sx = d.source.x;
          const sy = d.source.y;
          const tx = d.target.x;
          const ty = d.target.y;
          const mx = (sx + tx) / 2;
          const my = (sy + ty) / 2;
          const dx = tx - sx;
          const dy = ty - sy;
          const len = Math.hypot(dx, dy) || 1;
          const ny = dx / len; // perpendicular normal y
          const offset = Math.min(18, Math.max(8, Math.hypot(dx, dy) * 0.06));
          return my + ny * offset;
        });
    } catch (e) {
      // ignore any tick-time errors when nodes are not yet initialized
    }
  });

  // Notify callers when the simulation has settled so snapshots can be taken
  // after final positions are applied. Use both the 'end' event and a
  // small timeout fallback to avoid hanging if the simulation doesn't emit.
  let dispatched = false;
  const dispatchReady = () => {
    if (dispatched) return;
    dispatched = true;
    try {
      container.dispatchEvent(
        new CustomEvent("personNetworkReady", { bubbles: true })
      );
    } catch (e) {
      // ignore
    }
  };

  simulation.on("end", () => {
    // ensure final tick applied
    dispatchReady();
  });

  // Fallback: dispatch after ~700ms in case 'end' is not reached quickly
  setTimeout(() => dispatchReady(), 700);

  // Ensure drag cursor style changes while dragging (support pointer and mouse)
  node
    .selectAll("circle, rect, text")
    .on("pointerdown mousedown touchstart", function () {
      try {
        this.style.cursor = "grabbing";
      } catch (_) {}
    });
  // Restore cursor on pointerup/mouseup globally
  const restoreCursor = () => {
    try {
      node.style("cursor", "grab");
    } catch (_) {}
  };
  window.addEventListener("mouseup", restoreCursor);
  window.addEventListener("pointerup", restoreCursor);
}

export async function loadPersonNetwork(personId, { graphEl, relationsEl }) {
  if (!personId) return;
  try {
    const data = await fetchNetwork(personId);
    if (relationsEl) renderRelationsCard(relationsEl, data);
    if (graphEl) renderGraph(graphEl, data);
    return data;
  } catch (e) {
    if (relationsEl) {
      relationsEl.innerHTML = `<span class="text-xs text-gray-500">未找到该人员或无关系数据</span>`;
    }
    if (graphEl) {
      graphEl.innerHTML = `<div class="p-2 text-xs text-gray-500">加载失败：${String(
        e
      )}</div>`;
    }
    return null;
  }
}
