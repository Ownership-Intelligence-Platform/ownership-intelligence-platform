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

  const width = 900;
  const height = 520;
  const maxPen = d3.max(graph.nodes, (d) => d.penetration || 0) || 100;
  const radius = d3.scaleSqrt().domain([0, maxPen]).range([6, 30]);
  const color = d3
    .scaleSequential(d3.interpolateBlues)
    .domain([0, maxPen || 1]);
  const linkWidth = d3.scaleLinear().domain([0, 100]).range([0.5, 6]);

  const svg = d3
    .select(chartEl)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("border", "1px solid #eee")
    .style("background", "#fafafa");

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

  const defs = svg.append("defs");
  defs
    .append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 14)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
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

  const linkLabels = g
    .append("g")
    .selectAll("text")
    .data(graph.links)
    .enter()
    .append("text")
    .attr("font-size", 10)
    .attr("fill", "#555")
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
    .attr("fill", (d) => color(d.penetration || 0));

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
    .attr("font-size", 11)
    .attr("fill", "#333")
    .text((d) => {
      const base = d.name || "(no name)";
      return `${base} (${(d.penetration || 0).toFixed(1)}%)`;
    });

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
    linkLabels
      .attr("x", (d) => (d.source.x + d.target.x) / 2)
      .attr("y", (d) => (d.source.y + d.target.y) / 2);
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
