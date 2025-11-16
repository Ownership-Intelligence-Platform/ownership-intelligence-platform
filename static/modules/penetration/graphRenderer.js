// Renderer for equity penetration force-directed graph using D3
// Requires global d3 from CDN in index.html
// Color/style NOTE: Aligned with person network module (`static/modules/personNetwork.js`)
// - Focal (root) node: #1d4ed8
// - Company nodes: rect with fill #374151
// - Other/person nodes: circle with fill #6366f1
// - Link color (ownership/share): #6b7280 with 0.5 opacity

/**
 * Render an interactive force-directed graph showing equity penetration.
 * @param {{nodes:Array,links:Array}} graph
 * @param {Object} root
 */
export function renderPenetrationGraph(graph, root) {
  const chartEl = document.getElementById("penetrationChart");
  chartEl.innerHTML = "";
  if (!graph || !graph.nodes || !graph.nodes.length) {
    chartEl.textContent = "No graph data available.";
    return;
  }
  const prefersDark = document.documentElement.classList.contains("dark");
  const bgColor = prefersDark ? "#0f172a" : "#fbfbfc";
  const borderColor = prefersDark ? "#334155" : "#e5e7eb";
  // For white theme, use pure black text per requirement
  const textPrimary = prefersDark ? "#f3f4f6" : "#000000";
  const textHalo = prefersDark ? "#0b1220" : "#ffffff";
  // Use the same link color as person network for share/ownership relations
  const linkStrokeColor = "#6b7280"; // gray-500
  d3.select(chartEl).style("position", "relative");

  const containerRect = chartEl.getBoundingClientRect();
  const width = Math.max(640, Math.min(1280, containerRect.width || 900));
  const height = Math.round(width * 0.55);
  const maxPen = d3.max(graph.nodes, (d) => d.penetration || 0) || 100;
  const radius = d3.scaleSqrt().domain([0, maxPen]).range([6, 34]);
  // Person network color style
  const nodeFill = (d) => {
    if (root && d.id === root.id) return "#1d4ed8"; // focal blue
    if ((d.type || "").toLowerCase() === "company") return "#374151"; // company gray
    return "#6366f1"; // person/other indigo
  };
  const linkWidth = d3.scaleLinear().domain([0, 100]).range([0.75, 7]);
  const fonts = { base: 12, node: 12, link: 10 };

  const svg = d3
    .select(chartEl)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("border", `1px solid ${borderColor}`)
    .style("background", bgColor)
    .style(
      "font-family",
      "system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif"
    );

  if (root) {
    d3.select(chartEl)
      .insert("div", ":first-child")
      .style("margin", "6px 0")
      .style("color", textPrimary)
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

  // Controls
  createControls(
    chartEl,
    svg,
    zoom,
    g,
    radius,
    width,
    height,
    fonts,
    textPrimary,
    borderColor,
    root
  );

  // Defs & markers
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
    .attr("fill", linkStrokeColor);

  // Links & labels
  const { link, linkLabels } = renderLinks(
    g,
    graph.links,
    linkStrokeColor,
    linkWidth,
    fonts,
    textPrimary,
    textHalo
  );

  // Nodes
  const node = renderNodes(
    g,
    graph.nodes,
    radius,
    nodeFill,
    root,
    textPrimary,
    textHalo,
    borderColor,
    fonts
  );

  // Tooltip
  const tooltip = createTooltip(chartEl, prefersDark, fonts, textPrimary);
  addNodeInteractivity(node, link, linkLabels, tooltip, chartEl);

  // Embedded styles for fading and selection prevention
  svg
    .append("style")
    .text(`.faded { opacity: 0.15; } .linkLabel text { user-select: none; }`);

  // Legend
  createLegend(chartEl, maxPen, prefersDark, fonts, borderColor);

  // Simulation
  const sim = runSimulation(
    graph.nodes,
    graph.links,
    node,
    link,
    linkLabels,
    radius,
    width,
    height
  );
  attachDrag(node, sim);
}

function createControls(
  chartEl,
  svg,
  zoom,
  g,
  radius,
  width,
  height,
  fonts,
  textPrimary,
  borderColor,
  root
) {
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
}

function renderLinks(
  g,
  linksData,
  linkStrokeColor,
  linkWidth,
  fonts,
  textPrimary,
  textHalo
) {
  const link = g
    .append("g")
    .attr("stroke", linkStrokeColor)
    .attr("stroke-opacity", 0.5) // align with person network SHARE_COMPANY style
    .selectAll("line")
    .data(linksData)
    .enter()
    .append("line")
    .attr("stroke-width", (d) => linkWidth(d.stake || 0))
    .attr("marker-end", "url(#arrow)");

  const linkLabelsGroup = g.append("g");
  const linkLabels = linkLabelsGroup
    .selectAll("g.linkLabel")
    .data(linksData)
    .enter()
    .append("g")
    .attr("class", "linkLabel");
  linkLabels
    .append("text")
    .attr("font-size", `${fonts.link}px`)
    .attr("stroke", textHalo)
    .attr("stroke-width", 3)
    .attr("stroke-linejoin", "round")
    .attr("fill", textHalo)
    .attr("opacity", 0.9)
    .text((d) => formatLinkLabel(d));
  linkLabels
    .append("text")
    .attr("font-size", `${fonts.link}px`)
    .attr("fill", textPrimary)
    .text((d) => formatLinkLabel(d));
  return { link, linkLabels };
}

function formatLinkLabel(d) {
  const stakeTxt = d.stake != null ? `${Number(d.stake).toFixed(1)}%` : "";
  const ltTxt =
    d.lookthrough != null && !isNaN(d.lookthrough)
      ? ` (LT ${Number(d.lookthrough).toFixed(1)}%)`
      : "";
  return stakeTxt + ltTxt;
}

function renderNodes(
  g,
  nodesData,
  radius,
  nodeFill,
  root,
  textPrimary,
  textHalo,
  borderColor,
  fonts
) {
  const node = g
    .append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .selectAll("g.node")
    .data(nodesData)
    .enter()
    .append("g")
    .attr("class", "node");

  // Company nodes as rects, others as circles (match person network)
  const isCompany = (d) => (d.type || "").toLowerCase() === "company";

  node
    .filter((d) => isCompany(d))
    .append("rect")
    .attr("x", (d) => -radius(d.penetration || 0))
    .attr("y", (d) => -radius(d.penetration || 0))
    .attr("width", (d) => 2 * radius(d.penetration || 0))
    .attr("height", (d) => 2 * radius(d.penetration || 0))
    .attr("rx", 6)
    .attr("fill", (d) => nodeFill(d))
    .attr("stroke", (d) =>
      root && d.id === root.id ? textPrimary : borderColor
    )
    .attr("stroke-width", (d) => (root && d.id === root.id ? 2.2 : 1.5));

  node
    .filter((d) => !isCompany(d))
    .append("circle")
    .attr("r", (d) => radius(d.penetration || 0))
    .attr("fill", (d) => nodeFill(d))
    .attr("stroke", (d) =>
      root && d.id === root.id ? textPrimary : borderColor
    )
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
    .attr("class", "node-label-halo")
    .attr("x", 12)
    .attr("y", 4)
    .attr("font-size", `${fonts.node}px`)
    .style("stroke", textHalo)
    .style("stroke-width", 3)
    .style("stroke-linejoin", "round")
    .style("fill", textHalo)
    .style("opacity", 0.95)
    .text(
      (d) => `${d.name || "(no name)"} (${(d.penetration || 0).toFixed(1)}%)`
    );

  node
    .append("text")
    .attr("class", "node-label")
    .attr("x", 12)
    .attr("y", 4)
    .attr("font-size", `${fonts.node}px`)
    .style("fill", textPrimary)
    .text(
      (d) => `${d.name || "(no name)"} (${(d.penetration || 0).toFixed(1)}%)`
    );

  return node;
}

function createTooltip(chartEl, prefersDark, fonts, textPrimary) {
  return d3
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
    .style("color", prefersDark ? "#e5e7eb" : "#000000")
    .style(
      "box-shadow",
      prefersDark ? "0 2px 6px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.12)"
    )
    .style("visibility", "hidden");
}

function addNodeInteractivity(node, link, linkLabels, tooltip, chartEl) {
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
  const linkedById = new Set(
    link
      .data()
      .map((l) => `${l.source.id || l.source}->${l.target.id || l.target}`)
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

  // styles are injected once at the svg level in the caller
}

function createLegend(chartEl, maxPen, prefersDark, fonts, borderColor) {
  // Size legend: node size encodes penetration percentage
  const legend = d3
    .select(chartEl)
    .append("div")
    .style("margin-top", "6px")
    .style("font-size", `${fonts.base - 1}px`)
    .style("color", prefersDark ? "#d1d5db" : "#000000");
  const svg = legend
    .append("svg")
    .attr("width", 220)
    .attr("height", 48)
    .style("border", `1px solid ${borderColor}`);
  const r = d3.scaleSqrt().domain([0, maxPen]).range([6, 20]);
  const values = [0, Math.round(maxPen / 4), Math.round(maxPen / 2), maxPen];
  values.forEach((v, i) => {
    const cx = 20 + i * 50;
    const cy = 24;
    svg
      .append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", r(v))
      .attr("fill", "#e5e7eb")
      .attr("stroke", "#fff");
    svg
      .append("text")
      .attr("x", cx)
      .attr("y", 44)
      .attr("text-anchor", "middle")
      .attr("fill", prefersDark ? "#d1d5db" : "#000000")
      .attr("font-size", `${fonts.base - 2}px`)
      .text(`${v}%`);
  });
  legend
    .append("div")
    .style("margin-top", "4px")
    .text("节点大小代表穿透率 (Penetration)");
}

function runSimulation(
  nodes,
  links,
  nodeSel,
  linkSel,
  linkLabelsSel,
  radius,
  width,
  height
) {
  const sim = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
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
    linkSel
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    linkLabelsSel.attr(
      "transform",
      (d) =>
        `translate(${(d.source.x + d.target.x) / 2}, ${
          (d.source.y + d.target.y) / 2
        })`
    );
  });

  return sim;
}

function attachDrag(nodeSel, sim) {
  const drag = d3
    .drag()
    .on("start", (event, d) => {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
  nodeSel.call(drag);
}
