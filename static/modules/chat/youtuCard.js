import { appendMessage } from "./conversation.js";

export function renderYoutuCard(data, targetList) {
  // Remove the temporary "..." message if it exists
  const lastMsg = targetList.lastElementChild;
  if (lastMsg && lastMsg.textContent === "…") {
    lastMsg.remove();
  }

  const card = document.createElement("div");
  card.className =
    "bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-4 w-full max-w-3xl";

  // Header
  const header = document.createElement("div");
  header.className =
    "px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between";
  header.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="flex h-2 w-2 rounded-full bg-indigo-500"></span>
      <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">Youtu GraphRAG 结果</h3>
    </div>
    <span class="text-xs text-slate-500 dark:text-slate-400">Model: ${
      data.model || "youtu-graphrag"
    }</span>
  `;
  card.appendChild(header);

  // Content Body
  const body = document.createElement("div");
  body.className = "p-4 space-y-4";

  // 1. Answer Section
  if (data.reply) {
    const answerDiv = document.createElement("div");
    answerDiv.className =
      "prose dark:prose-invert text-sm max-w-none text-slate-700 dark:text-slate-300";
    answerDiv.innerHTML = `<p>${data.reply}</p>`;
    body.appendChild(answerDiv);
  }

  // 2. Visualization (Triples Graph)
  const triples = data.youtu_data?.retrieved_triples || [];
  if (triples.length > 0) {
    const graphContainer = document.createElement("div");
    graphContainer.className =
      "h-64 w-full bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 relative";
    body.appendChild(graphContainer);

    // Defer graph rendering slightly to ensure container has dimensions
    setTimeout(() => renderTriplesGraph(graphContainer, triples), 50);
  }

  // 3. Sources / Chunks
  const chunks = data.youtu_data?.retrieved_chunks || [];
  if (chunks.length > 0) {
    const sourcesDiv = document.createElement("div");
    sourcesDiv.className =
      "mt-4 border-t border-slate-100 dark:border-slate-700 pt-3";

    const sourcesHeader = document.createElement("h4");
    sourcesHeader.className =
      "text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2";
    sourcesHeader.textContent = "参考来源 / 事实片段";
    sourcesDiv.appendChild(sourcesHeader);

    const sourcesList = document.createElement("ul");
    sourcesList.className = "space-y-2";

    chunks.slice(0, 3).forEach((chunkStr, idx) => {
      // Limit to top 3 to save space
      let chunk = {};
      try {
        // Handle Python-style string representation of dict if necessary, or just parse JSON
        // The example output shows Python repr string: "{'title': ...}" which is not valid JSON.
        // We'll do a simple heuristic parse or just display raw text if parsing fails.
        const fixedJson = chunkStr.replace(/'/g, '"').replace(/\\n/g, " "); // Very rough fix for demo
        chunk = JSON.parse(fixedJson);
      } catch (e) {
        // Fallback: treat as raw string or try regex extraction
        chunk = { text: chunkStr };
      }

      const li = document.createElement("li");
      li.className =
        "text-xs bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-700/50";

      const title = chunk.title
        ? `<div class="font-medium text-indigo-600 dark:text-indigo-400 mb-1">${chunk.title}</div>`
        : "";
      const text = chunk.text || chunkStr;

      li.innerHTML = `
        ${title}
        <div class="text-slate-600 dark:text-slate-400 line-clamp-2" title="${text.replace(
          /"/g,
          "&quot;"
        )}">${text}</div>
      `;
      sourcesList.appendChild(li);
    });

    if (chunks.length > 3) {
      const more = document.createElement("div");
      more.className = "text-xs text-center text-slate-400 mt-1 italic";
      more.textContent = `... 还有 ${chunks.length - 3} 条相关片段`;
      sourcesList.appendChild(more);
    }

    sourcesDiv.appendChild(sourcesList);
    body.appendChild(sourcesDiv);
  }

  card.appendChild(body);
  targetList.appendChild(card);

  // Scroll to bottom
  targetList.scrollTop = targetList.scrollHeight;
}

function renderTriplesGraph(container, triplesRaw) {
  // Parse triples: "(Subject [type], predicate, Object [type]) [score]"
  // Regex to extract parts. This is a simplified parser.
  const nodes = new Map();
  const links = [];

  triplesRaw.forEach((t) => {
    // Remove score for parsing
    const clean = t.replace(/\[score:.*?\]$/, "").trim();
    // Remove outer parens
    const content = clean.substring(1, clean.length - 1);

    // Split by comma, but be careful about commas inside []
    // Simple approach: split by ", " which seems consistent in the output
    const parts = content.split(/,\s+(?![^\[]*\])/);

    if (parts.length >= 3) {
      const subjRaw = parts[0].trim();
      const pred = parts[1].trim();
      const objRaw = parts[2].trim();

      const parseNode = (raw) => {
        const match = raw.match(/^(.*?)(\s*\[(.*?)\])?$/);
        if (!match) return { id: raw, type: "unknown" };
        return {
          id: match[1].trim(),
          type: match[3]
            ? match[3].replace("schema_type:", "").trim()
            : "unknown",
        };
      };

      const subj = parseNode(subjRaw);
      const obj = parseNode(objRaw);

      if (!nodes.has(subj.id))
        nodes.set(subj.id, { id: subj.id, group: getGroup(subj.type) });
      if (!nodes.has(obj.id))
        nodes.set(obj.id, { id: obj.id, group: getGroup(obj.type) });

      links.push({ source: subj.id, target: obj.id, label: pred });
    }
  });

  const graphData = {
    nodes: Array.from(nodes.values()),
    links: links,
  };

  // D3 Force Graph
  const width = container.clientWidth;
  const height = container.clientHeight;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height]);

  const simulation = d3
    .forceSimulation(graphData.nodes)
    .force(
      "link",
      d3
        .forceLink(graphData.links)
        .id((d) => d.id)
        .distance(100)
    )
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(30));

  // Arrow marker
  svg
    .append("defs")
    .selectAll("marker")
    .data(["end"])
    .enter()
    .append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 25) // Adjust based on node radius
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#94a3b8");

  const link = svg
    .append("g")
    .selectAll("line")
    .data(graphData.links)
    .join("line")
    .attr("stroke", "#cbd5e1")
    .attr("stroke-width", 1.5)
    .attr("marker-end", "url(#arrow)");

  const linkLabel = svg
    .append("g")
    .selectAll("text")
    .data(graphData.links)
    .join("text")
    .attr("dy", -3)
    .attr("font-size", "10px")
    .attr("fill", "#64748b")
    .attr("text-anchor", "middle")
    .text((d) => d.label);

  const node = svg
    .append("g")
    .selectAll("g")
    .data(graphData.nodes)
    .join("g")
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    );

  node
    .append("circle")
    .attr("r", 8)
    .attr("fill", (d) =>
      d.group === 1 ? "#6366f1" : d.group === 2 ? "#10b981" : "#f59e0b"
    )
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5);

  node
    .append("text")
    .attr("dx", 12)
    .attr("dy", 4)
    .text((d) => d.id)
    .attr("font-size", "10px")
    .attr("fill", "#334155")
    .style("pointer-events", "none");

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    linkLabel
      .attr("x", (d) => (d.source.x + d.target.x) / 2)
      .attr("y", (d) => (d.source.y + d.target.y) / 2);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

function getGroup(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("person")) return 1;
  if (t.includes("organization") || t.includes("company")) return 2;
  return 3;
}
