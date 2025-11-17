// Simple renderer for equity penetration force-directed graph using D3
// Requires global d3 from CDN in index.html

/**
 * Render a minimal interactive force-directed graph.
 * Keeps only essentials: SVG, zoom/pan, nodes, links, simple labels, drag.
 * @param {{nodes:Array,links:Array}} graph
 * @param {Object} root
 */
export function renderPenetrationGraph(graph, root) {
  const chartEl = document.getElementById("penetrationChart");
  chartEl.innerHTML = "";
  if (!graph || !graph.nodes || !graph.nodes.length) {
    chartEl.textContent = "No graph data.";
    return;
  }

  const rect = chartEl.getBoundingClientRect();
  const width = Math.max(600, rect.width || 800);
  const height = Math.round(width * 0.6);

  const maxPen = d3.max(graph.nodes, (d) => d.penetration || 0) || 100;
  const radius = d3.scaleSqrt().domain([0, maxPen]).range([6, 28]);
  const linkWidth = d3.scaleLinear().domain([0, 100]).range([0.5, 6]);

  // Ensure container allows absolute tooltip or future overlays if needed
  d3.select(chartEl).style("position", "relative");

  const svg = d3
    .select(chartEl)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  // Theme-aware background and border
  let theme = "light";
  if (
    document.body.classList.contains("dark") ||
    document.body.getAttribute("data-theme") === "dark"
  ) {
    theme = "dark";
  }
  const bgColor = theme === "dark" ? "#222" : "#fff";
  const borderColor = theme === "dark" ? "#444" : "#ccc";
  svg
    .style("background", bgColor)
    .style("border", `1px solid ${borderColor}`)
    .style("border-radius", "8px");
  const g = svg.append("g");

  // Zoom/pan
  const zoom = d3
    .zoom()
    .scaleExtent([0.2, 4])
    .on("zoom", (event) => g.attr("transform", event.transform));
  svg.call(zoom);

  // Radial pre-seed to avoid initial overlap & give readable first frame
  const cx = width / 2;
  const cy = height / 2;
  const baseR = Math.min(width, height) / 3;
  graph.nodes.forEach((n, i) => {
    const ang = (i / graph.nodes.length) * Math.PI * 2;
    n.x = cx + Math.cos(ang) * baseR * 0.7 + (Math.random() - 0.5) * 20;
    n.y = cy + Math.sin(ang) * baseR * 0.7 + (Math.random() - 0.5) * 20;
  });

  // Links
  const link = g
    .append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(graph.links)
    .enter()
    .append("line")
    .attr("stroke-width", (d) => linkWidth(d.stake || 0));

  // Nodes
  const node = g
    .append("g")
    .selectAll("g.node")
    .data(graph.nodes)
    .enter()
    .append("g")
    .attr("class", "node");

  node
    .append("circle")
    .attr("r", (d) => radius(d.penetration || 0))
    .attr("fill", (d) => (root && d.id === root.id ? "#1d4ed8" : "#6366f1"))
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5);

  // Simple labels
  node
    .append("text")
    .attr("x", 10)
    .attr("y", 4)
    .attr("font-size", 11)
    .attr("fill", "#333")
    .text((d) => d.name || "");

  // Default tooltip via <title>
  node
    .append("title")
    .text(
      (d) =>
        `${d.name || "(no name)"}\n[${d.id}]${
          d.type ? " · " + d.type : ""
        }\nPenetration: ${(d.penetration || 0).toFixed(1)}%`
    );

  // Simulation
  const sim = d3
    .forceSimulation(graph.nodes)
    .force(
      "link",
      d3
        .forceLink(graph.links)
        .id((d) => d.id)
        .distance(90)
        .strength(0.25)
    )
    .force("charge", d3.forceManyBody().strength(-220))
    .force("center", d3.forceCenter(cx, cy))
    .force(
      "collide",
      d3.forceCollide().radius((d) => radius(d.penetration || 0) + 8)
    );

  // Run some synchronous ticks for immediate layout
  for (let i = 0; i < 60; i++) sim.tick();
  link
    .attr("x1", (d) => d.source.x)
    .attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x)
    .attr("y2", (d) => d.target.y);
  node.attr("transform", (d) => `translate(${d.x},${d.y})`);

  // Continue lighter live adjustments
  sim.alpha(0.3).restart();
  sim.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  // Drag
  const drag = d3
    .drag()
    .on("start", (event, d) => {
      if (!event.active) sim.alphaTarget(0.25).restart();
      d.fx = d.x;
      d.fy = d.y;
      svg.style("cursor", "grabbing");
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      svg.style("cursor", "grab");
    });
  node.call(drag);
  svg
    .style("cursor", "grab")
    .style("user-select", "none")
    .style("touch-action", "none");
}
