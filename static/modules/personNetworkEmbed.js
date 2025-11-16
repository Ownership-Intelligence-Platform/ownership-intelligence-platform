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
        .map(
          (pid) =>
            `<span class="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">${escapeHtml(
              id2name.get(pid) || pid
            )}</span>`
        )
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
  const rect = container.getBoundingClientRect();
  const width = Math.max(480, rect.width || container.clientWidth || 640);
  const height = Math.max(280, rect.height || container.clientHeight || 420);

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", width)
    .attr("height", height);

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

  const links = (data.links || []).map((l) => ({ ...l }));
  const nodes = (data.nodes || []).map((n) => ({ ...n }));

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance((d) => 110)
    )
    .force("charge", d3.forceManyBody().strength(-220))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(36));

  const link = svg
    .append("g")
    .attr("stroke-width", 1.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", linkColor)
    .attr("stroke-opacity", 0.8);

  const node = svg
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(
      d3
        .drag()
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
        })
    );

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
    .text((d) => `${d.name || d.id}`)
    .attr("x", 20)
    .attr("y", 3)
    .attr("font-size", 10)
    .attr("fill", "#111827")
    .attr("paint-order", "stroke")
    .attr("stroke", "white")
    .attr("stroke-width", 3)
    .attr("stroke-linejoin", "round");

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });
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
