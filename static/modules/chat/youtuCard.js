import { appendMessage } from "./conversation.js";

export function renderYoutuCard(data, targetList) {
  // Remove the temporary "..." message if it exists
  const lastMsg = targetList.lastElementChild;
  if (lastMsg && lastMsg.textContent === "…") {
    lastMsg.remove();
  }

  const card = document.createElement("div");
  // Changed max-w-3xl to w-full to use full available width
  card.className =
    "bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-4 w-full";

  // Header
  const header = document.createElement("div");
  header.className =
    "px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between";

  const btnId = `btn-export-pdf-${Date.now()}-${Math.floor(
    Math.random() * 1000
  )}`;
  header.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="flex h-2 w-2 rounded-full bg-indigo-500"></span>
      <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">Youtu GraphRAG 结果</h3>
    </div>
    <div class="flex items-center gap-3">
        <button id="${btnId}" class="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded shadow-sm transition-colors flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export PDF
        </button>
        <span class="text-xs text-slate-500 dark:text-slate-400">Model: ${
          data.model || "youtu-graphrag"
        }</span>
    </div>
  `;
  card.appendChild(header);

  // Event Listener for PDF Export
  setTimeout(() => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener("click", async () => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="animate-spin">↻</span> Generating...';
        btn.disabled = true;
        try {
          const response = await fetch("/reports/youtu-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error("Export failed");
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `intelligence_briefing_${Date.now()}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
        } catch (e) {
          console.error(e);
          alert("Failed to generate PDF");
        } finally {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
      });
    }
  }, 0);

  // Content Body
  const body = document.createElement("div");
  body.className = "p-4 space-y-4";

  // 1. Answer Section
  if (data.reply) {
    const answerDiv = document.createElement("div");
    answerDiv.className =
      "prose dark:prose-invert text-sm max-w-none text-slate-700 dark:text-slate-300 leading-relaxed";
    answerDiv.innerHTML = `<p>${data.reply}</p>`;
    body.appendChild(answerDiv);
  }

  // 2. Visualization (Triples Graph)
  const triples = data.youtu_data?.retrieved_triples || [];
  if (triples.length > 0) {
    const graphWrapper = document.createElement("div");
    graphWrapper.className =
      "relative w-full rounded border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900";

    // Increased height for better visibility
    const graphContainer = document.createElement("div");
    graphContainer.className = "h-96 w-full";
    graphWrapper.appendChild(graphContainer);

    // Legend Overlay
    const legendDiv = document.createElement("div");
    legendDiv.className =
      "absolute top-2 left-2 bg-white/90 dark:bg-slate-800/90 p-2 rounded border border-slate-200 dark:border-slate-700 text-xs shadow-sm pointer-events-none";
    legendDiv.innerHTML = `
      <div class="flex items-center gap-2 mb-1"><span class="w-2 h-2 rounded-full bg-indigo-500"></span> Person (人物)</div>
      <div class="flex items-center gap-2 mb-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Organization (机构)</div>
      <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500"></span> Other (其他)</div>
    `;
    graphWrapper.appendChild(legendDiv);

    // Help Text Overlay
    const helpDiv = document.createElement("div");
    helpDiv.className =
      "absolute bottom-2 right-2 text-[10px] text-slate-400 pointer-events-none select-none";
    helpDiv.textContent = "支持拖拽节点 · 滚轮缩放 · 双击复位";
    graphWrapper.appendChild(helpDiv);

    body.appendChild(graphWrapper);

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
    sourcesList.className = "grid grid-cols-1 md:grid-cols-2 gap-2"; // Grid layout for sources

    chunks.slice(0, 4).forEach((chunkStr, idx) => {
      let chunk = {};
      try {
        const fixedJson = chunkStr.replace(/'/g, '"').replace(/\\n/g, " ");
        chunk = JSON.parse(fixedJson);
      } catch (e) {
        chunk = { text: chunkStr };
      }

      const li = document.createElement("li");
      li.className =
        "text-xs bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-700/50 flex flex-col h-full";

      const title = chunk.title
        ? `<div class="font-medium text-indigo-600 dark:text-indigo-400 mb-1 truncate" title="${chunk.title}">${chunk.title}</div>`
        : "";
      const text = chunk.text || chunkStr;

      li.innerHTML = `
        ${title}
        <div class="text-slate-600 dark:text-slate-400 line-clamp-3 flex-1" title="${text.replace(
          /"/g,
          "&quot;"
        )}">${text}</div>
      `;
      sourcesList.appendChild(li);
    });

    if (chunks.length > 4) {
      const more = document.createElement("div");
      more.className =
        "col-span-full text-xs text-center text-slate-400 mt-1 italic";
      more.textContent = `... 还有 ${chunks.length - 4} 条相关片段`;
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
  const nodes = new Map();
  const links = [];

  triplesRaw.forEach((t) => {
    const clean = t.replace(/\[score:.*?\]$/, "").trim();
    const content = clean.substring(1, clean.length - 1);
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

  const width = container.clientWidth;
  const height = container.clientHeight;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", [0, 0, width, height])
    .style("cursor", "grab");

  // Add Zoom behavior
  const g = svg.append("g");

  const zoom = d3
    .zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg
    .call(zoom)
    .on("dblclick.zoom", () =>
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity)
    );

  const simulation = d3
    .forceSimulation(graphData.nodes)
    .force(
      "link",
      d3
        .forceLink(graphData.links)
        .id((d) => d.id)
        .distance(120)
    )
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(40));

  // Arrow marker
  svg
    .append("defs")
    .selectAll("marker")
    .data(["end"])
    .enter()
    .append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 28) // Adjusted for larger node radius
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#94a3b8");

  const link = g
    .append("g")
    .selectAll("line")
    .data(graphData.links)
    .join("line")
    .attr("stroke", "#cbd5e1")
    .attr("stroke-width", 1.5)
    .attr("marker-end", "url(#arrow)");

  const linkLabel = g
    .append("g")
    .selectAll("text")
    .data(graphData.links)
    .join("text")
    .attr("dy", -4)
    .attr("font-size", "10px")
    .attr("fill", "#64748b")
    .attr("text-anchor", "middle")
    .style("pointer-events", "none") // Let clicks pass through
    .style("text-shadow", "0 1px 2px rgba(255,255,255,0.8)")
    .text((d) => d.label);

  const node = g
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
    .attr("r", 10) // Slightly larger nodes
    .attr("fill", (d) =>
      d.group === 1 ? "#6366f1" : d.group === 2 ? "#10b981" : "#f59e0b"
    )
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .style("cursor", "pointer");

  node
    .append("text")
    .attr("dx", 14)
    .attr("dy", 4)
    .text((d) => d.id)
    .attr("font-size", "11px")
    .attr("font-weight", "500")
    .attr("fill", "#1e293b")
    .style("pointer-events", "none")
    .style("text-shadow", "0 1px 4px rgba(255,255,255,0.9)");

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
    svg.style("cursor", "grabbing");
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
    svg.style("cursor", "grab");
  }
}

function getGroup(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("person")) return 1;
  if (t.includes("organization") || t.includes("company")) return 2;
  return 3;
}
