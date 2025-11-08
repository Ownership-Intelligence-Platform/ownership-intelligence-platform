// Equity penetration graph using D3
// Requires global d3 from CDN in index.html

/** Combine layers and penetration payloads into a D3-friendly graph. */
export function buildGraphFromLayersAndPenetration(
  layersPayload,
  penetrationPayload
) {
  const nodesById = new Map();
  const penetrationById = new Map();
  const links = [];

  (penetrationPayload?.items || []).forEach((item) => {
    if (item?.id != null) penetrationById.set(item.id, item.penetration || 0);
  });

  const ensureNode = (n) => {
    if (!n || !n.id) return null;
    if (!nodesById.has(n.id)) {
      nodesById.set(n.id, {
        id: n.id,
        name: n.name,
        type: n.type,
        penetration: penetrationById.get(n.id) || 0,
      });
    } else {
      const ref = nodesById.get(n.id);
      if (n.name) ref.name = n.name;
      if (n.type) ref.type = n.type;
    }
    return nodesById.get(n.id);
  };

  let rootId = null;
  if (layersPayload?.root) {
    const r = ensureNode(layersPayload.root);
    rootId = layersPayload.root.id;
    if (r && (r.penetration == null || r.penetration === 0))
      r.penetration = 100;
  }

  (layersPayload?.layers || []).forEach((path) => {
    const nodes = path?.nodes || [];
    const rels = path?.rels || [];
    nodes.forEach(ensureNode);
    rels.forEach((rel) => {
      if (!rel) return;
      const s = nodesById.get(rel.from);
      const t = nodesById.get(rel.to);
      if (!s || !t) return;
      const key = `${rel.from}->${rel.to}`;
      if (!links.find((l) => l._k === key)) {
        const parentPen =
          rel.from === rootId ? 100 : penetrationById.get(rel.from) || 0;
        const lt = (parentPen * (Number(rel.stake) || 0)) / 100;
        links.push({
          source: rel.from,
          target: rel.to,
          stake: rel.stake,
          lookthrough: lt,
          _k: key,
        });
      }
    });
  });

  return { nodes: Array.from(nodesById.values()), links };
}

/** Render an interactive force-directed graph showing equity penetration. */
export function renderPenetrationGraph(graph, root) {
  const chartEl = document.getElementById("penetrationChart");
  chartEl.innerHTML = "";
  if (!graph || !graph.nodes || !graph.nodes.length) {
    chartEl.textContent = "No graph data available.";
    return;
  }
  // Ensure chart container is the positioning context for overlays
  d3.select(chartEl).style("position", "relative");

  // Responsive sizing and style config
  const containerRect = chartEl.getBoundingClientRect();
  const width = Math.max(640, Math.min(1280, containerRect.width || 900));
  const height = Math.round(width * 0.55);
  const maxPen = d3.max(graph.nodes, (d) => d.penetration || 0) || 100;
  const radius = d3.scaleSqrt().domain([0, maxPen]).range([6, 34]);
  const color = d3.scaleSequential(d3.interpolatePuBu).domain([0, maxPen || 1]);
  const linkWidth = d3.scaleLinear().domain([0, 100]).range([0.75, 7]);
  const fonts = { base: 12, node: 12, link: 10 };

  const svg = d3
    .select(chartEl)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("border", "1px solid #e5e7eb")
    .style("background", "#fbfbfc")
    .style(
      "font-family",
      "system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif"
    );

  if (root) {
    d3.select(chartEl)
      .insert("div", ":first-child")
      .style("margin", "6px 0")
      .style("color", "#555")
      .text(
        `Root: ${root.name || ""} [${root.id}]${
          root.type ? " · " + root.type : ""
        }`
      );
  }

  const g = svg.append("g");
  const zoom = d3
    .zoom()
    .scaleExtent([0.2, 4])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
  svg.call(zoom);

  // Overlay: Reset and Fit buttons
  const controls = d3
    .select(chartEl)
    .append("div")
    .style("position", "absolute")
    .style("top", "6px")
    .style("right", "6px")
    .style("display", "flex")
    .style("gap", "6px")
    .style("z-index", 10);
  const mkBtn = (label, title, onClick) =>
    controls
      .append("button")
      .text(label)
      .attr("title", title)
      .style("padding", "4px 8px")
      .style("border", "1px solid #cbd5e1")
      .style("border-radius", "6px")
      .style("background", "#ffffff")
      .style("font-size", `${fonts.base}px`)
      .style("cursor", "pointer")
      .on("click", onClick);
  mkBtn("Reset", "Reset zoom", () =>
    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity)
  );
  mkBtn("Fit", "Fit graph to view", () => {
    const nodesSel = g.selectAll("g.node");
    if (!nodesSel.size()) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    nodesSel.each((d) => {
      const r = radius(d.penetration || 0);
      minX = Math.min(minX, d.x - r);
      minY = Math.min(minY, d.y - r);
      maxX = Math.max(maxX, d.x + r);
      maxY = Math.max(maxY, d.y + r);
    });
    const bW = maxX - minX || 1;
    const bH = maxY - minY || 1;
    const scale = Math.min(width / bW, height / bH) * 0.85;
    const tx = (width - scale * (minX + maxX)) / 2;
    const ty = (height - scale * (minY + maxY)) / 2;
    svg
      .transition()
      .duration(450)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  });

  const defs = svg.append("defs");
  defs
    .append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 12)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("markerUnits", "strokeWidth")
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#999");

  const link = g
    .append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(graph.links)
    .enter()
    .append("line")
    .attr("stroke-width", (d) => linkWidth(d.stake || 0))
    .attr("marker-end", "url(#arrow)");
  // Link labels with readable outline (two-layer text)
  const linkLabelsGroup = g.append("g");
  const linkLabels = linkLabelsGroup
    .selectAll("g.linkLabel")
    .data(graph.links)
    .enter()
    .append("g")
    .attr("class", "linkLabel");
  linkLabels
    .append("text")
    .attr("font-size", `${fonts.link}px`)
    .attr("stroke", "#fff")
    .attr("stroke-width", 3)
    .attr("stroke-linejoin", "round")
    .attr("fill", "#fff")
    .attr("opacity", 0.9)
    .text((d) => {
      const stakeTxt = d.stake != null ? `${Number(d.stake).toFixed(1)}%` : "";
      const ltTxt =
        d.lookthrough != null && !isNaN(d.lookthrough)
          ? ` (LT ${Number(d.lookthrough).toFixed(1)}%)`
          : "";
      return stakeTxt + ltTxt;
    });
  linkLabels
    .append("text")
    .attr("font-size", `${fonts.link}px`)
    .attr("fill", "#2d2d2d")
    .text((d) => {
      const stakeTxt = d.stake != null ? `${Number(d.stake).toFixed(1)}%` : "";
      const ltTxt =
        d.lookthrough != null && !isNaN(d.lookthrough)
          ? ` (LT ${Number(d.lookthrough).toFixed(1)}%)`
          : "";
      return stakeTxt + ltTxt;
    });

  const node = g
    .append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .selectAll("g.node")
    .data(graph.nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    );

  node
    .append("circle")
    .attr("r", (d) => radius(d.penetration || 0))
    .attr("fill", (d) => color(d.penetration || 0))
    .attr("stroke", (d) => (root && d.id === root.id ? "#111" : "#fff"))
    .attr("stroke-width", (d) => (root && d.id === root.id ? 2.2 : 1.5));

  node
    .append("title")
    .text(
      (d) =>
        `${d.name || "(no name)"}\n[${d.id}]${
          d.type ? " · " + d.type : ""
        }\nPenetration: ${(d.penetration || 0).toFixed(2)}%`
    );

  node
    .append("text")
    .attr("x", 12)
    .attr("y", 4)
    .attr("font-size", `${fonts.node}px`)
    .attr("fill", "#2b2b2b")
    .text((d) => {
      const base = d.name || "(no name)";
      return `${base} (${(d.penetration || 0).toFixed(1)}%)`;
    });

  // Tooltip (HTML) for richer display
  const prefersDark = document.documentElement.classList.contains("dark");
  const tooltip = d3
    .select(chartEl)
    .append("div")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style(
      "background",
      prefersDark ? "rgba(17,24,39,0.95)" : "rgba(255,255,255,0.97)"
    )
    .style("border", prefersDark ? "1px solid #334155" : "1px solid #e5e7eb")
    .style("padding", "6px 8px")
    .style("border-radius", "6px")
    .style("font-size", `${fonts.base}px`)
    .style("color", prefersDark ? "#e5e7eb" : "#111827")
    .style(
      "box-shadow",
      prefersDark ? "0 2px 6px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.12)"
    )
    .style("visibility", "hidden");

  function showTooltip(event, d) {
    const rect = chartEl.getBoundingClientRect();
    const x = event.clientX - rect.left + 14;
    const y = event.clientY - rect.top + 14;
    const html = `<strong>${d.name || "(no name)"}</strong><br/>ID: ${
      d.id
    }<br/>${d.type ? `Type: ${d.type}<br/>` : ""}Penetration: ${(
      d.penetration || 0
    ).toFixed(2)}%`;
    tooltip
      .html(html)
      .style("left", `${x}px`)
      .style("top", `${y}px`)
      .style("visibility", "visible");
  }
  function hideTooltip() {
    tooltip.style("visibility", "hidden");
  }

  // Neighbor highlighting
  const linkedById = new Set(
    graph.links.map(
      (l) => `${l.source.id || l.source}->${l.target.id || l.target}`
    )
  );
  function isConnected(a, b) {
    return (
      a.id === b.id ||
      linkedById.has(`${a.id}->${b.id}`) ||
      linkedById.has(`${b.id}->${a.id}`)
    );
  }
  node
    .on("mouseover", function (event, d) {
      showTooltip(event, d);
      node.classed("faded", (o) => !isConnected(d, o));
      link.classed(
        "faded",
        (l) => !(l.source.id === d.id || l.target.id === d.id)
      );
      linkLabels.classed(
        "faded",
        (l) => !(l.source.id === d.id || l.target.id === d.id)
      );
    })
    .on("mousemove", function (event, d) {
      showTooltip(event, d);
    })
    .on("mouseout", function () {
      hideTooltip();
      node.classed("faded", false);
      link.classed("faded", false);
      linkLabels.classed("faded", false);
    });

  // Embedded styles for fading and selection prevention
  svg.append("style").text(
    `.faded { opacity: 0.15; }
       .linkLabel text { user-select: none; }
      `
  );

  // Legend (color gradient for penetration)
  const legendWidth = 180,
    legendHeight = 12;
  const legend = d3
    .select(chartEl)
    .append("div")
    .style("margin-top", "6px")
    .style("font-size", `${fonts.base - 1}px`)
    .style("color", prefersDark ? "#d1d5db" : "#374151");
  const canvas = document.createElement("canvas");
  canvas.width = legendWidth;
  canvas.height = legendHeight;
  const ctx = canvas.getContext("2d");
  for (let i = 0; i < legendWidth; i++) {
    const t = i / (legendWidth - 1);
    ctx.fillStyle = color(t * maxPen);
    ctx.fillRect(i, 0, 1, legendHeight);
  }
  legend.append(() => canvas).style("border", "1px solid #d1d5db");
  legend
    .append("div")
    .style("display", "flex")
    .style("justify-content", "space-between")
    .style("margin-top", "2px")
    .html(
      `<span>0%</span><span>Penetration</span><span>${maxPen.toFixed(
        0
      )}%</span>`
    );

  const sim = d3
    .forceSimulation(graph.nodes)
    .force(
      "link",
      d3
        .forceLink(graph.links)
        .id((d) => d.id)
        .distance(90)
        .strength(0.2)
    )
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force(
      "collide",
      d3.forceCollide().radius((d) => radius(d.penetration || 0) + 10)
    );

  sim.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    linkLabels.attr(
      "transform",
      (d) =>
        `translate(${(d.source.x + d.target.x) / 2}, ${
          (d.source.y + d.target.y) / 2
        })`
    );
  });

  function dragstarted(event, d) {
    if (!event.active) sim.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) sim.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

/** High-level loader: fetch penetration + layers, then render graph. */
export async function loadPenetration() {
  const rootId = document.getElementById("rootId").value.trim();
  const depth = Number(document.getElementById("depth").value || 3);
  if (!rootId) {
    alert("Please enter a root entity id");
    return;
  }
  const statusEl = document.getElementById("status");
  statusEl.textContent = "Loading penetration…";
  try {
    const [penRes, layersRes] = await Promise.all([
      fetch(`/penetration/${encodeURIComponent(rootId)}?depth=${depth}`),
      fetch(`/layers/${encodeURIComponent(rootId)}?depth=${depth}`),
    ]);
    if (!penRes.ok) {
      const txt = await penRes.text();
      document.getElementById(
        "penetrationChart"
      ).textContent = `Failed to load penetration: ${penRes.status} ${txt}`;
      statusEl.textContent = "";
      return;
    }
    if (!layersRes.ok) {
      const txt = await layersRes.text();
      document.getElementById(
        "penetrationChart"
      ).textContent = `Failed to load layers: ${layersRes.status} ${txt}`;
      statusEl.textContent = "";
      return;
    }
    const penData = await penRes.json();
    const layersData = await layersRes.json();
    const graph = buildGraphFromLayersAndPenetration(layersData, penData);
    renderPenetrationGraph(graph, penData?.root);
  } catch (e) {
    document.getElementById("penetrationChart").textContent = `Error: ${e}`;
  } finally {
    setTimeout(() => (statusEl.textContent = ""), 1500);
  }
}
