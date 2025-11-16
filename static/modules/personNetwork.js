// Person Network visualization module
// Color/style contract (reused by penetration graph):
// - Focal person: #1d4ed8
// - Company nodes: rect with fill #374151
// - Other/person nodes: circle with fill #6366f1
// - SHARE_COMPANY link color: #6b7280 (others vary by relation)

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function fetchNetwork(personId) {
  const res = await fetch(`/person-network/${encodeURIComponent(personId)}`);
  if (!res.ok) {
    throw new Error(`Failed (${res.status})`);
  }
  return await res.json();
}

async function fetchAccountOpening(personId) {
  const res = await fetch(
    `/persons/${encodeURIComponent(personId)}/account-opening`
  );
  if (!res.ok) {
    throw new Error(`Failed to load account opening (${res.status})`);
  }
  return await res.json();
}

function renderGraph(container, data) {
  container.innerHTML = "";
  const width = container.clientWidth;
  const height = container.clientHeight;

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

  // map link style
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

  const links = data.links.map((l) => ({ ...l }));
  const nodes = data.nodes.map((n) => ({ ...n }));

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance((d) => (d.type === "SHARE_COMPANY" ? 140 : 90))
    )
    .force("charge", d3.forceManyBody().strength(-220))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(48));

  // Links
  const link = svg
    .append("g")
    .attr("stroke-width", 1.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", linkColor)
    .attr("stroke-opacity", (d) => (d.type === "SHARE_COMPANY" ? 0.5 : 0.85));

  // Company nodes as rects, persons as circles
  const node = svg
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(drag(simulation));

  node
    .filter((d) => (d.type || "").toLowerCase() === "company")
    .append("rect")
    .attr("x", -18)
    .attr("y", -18)
    .attr("width", 36)
    .attr("height", 36)
    .attr("rx", 6)
    .attr("fill", color)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5);

  node
    .filter((d) => (d.type || "").toLowerCase() !== "company")
    .append("circle")
    .attr("r", 20)
    .attr("fill", color)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5);

  node
    .append("text")
    .text((d) => `${d.name || d.id}`)
    .attr("x", 24)
    .attr("y", 4)
    .attr("font-size", 11)
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

  // Tooltip
  const tooltip = d3
    .select(container)
    .append("div")
    .style("position", "absolute")
    .style("background", "rgba(0,0,0,0.7)")
    .style("color", "#fff")
    .style("padding", "4px 8px")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("opacity", 0);

  node.on("mouseenter", (event, d) => {
    tooltip
      .style("opacity", 1)
      .html(`<strong>${d.name || d.id}</strong><br/>${d.type || ""}`);
  });
  node.on("mousemove", (event) => {
    tooltip
      .style("left", event.offsetX + 12 + "px")
      .style("top", event.offsetY + 12 + "px");
  });
  node.on("mouseleave", () => tooltip.style("opacity", 0));
}

function drag(simulation) {
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
  return d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

async function init() {
  const personParam = getParam("person");
  if (personParam) {
    document.getElementById("personId").value = personParam;
    await load();
  }
  document.getElementById("loadNetwork").addEventListener("click", load);
}

async function load() {
  const pid = document.getElementById("personId").value.trim();
  if (!pid) {
    alert("Enter a person id.");
    return;
  }
  const status = document.getElementById("status");
  status.textContent = "Loading network…";
  try {
    const [data, ao] = await Promise.all([
      fetchNetwork(pid),
      fetchAccountOpening(pid).catch(() => null),
    ]);
    renderRelationsCard(document.getElementById("relationsCard"), data);
    renderGraph(document.getElementById("graph"), data);
    document.getElementById("raw").textContent = JSON.stringify(data, null, 2);

    // Render account opening info if present
    const aoBox = document.getElementById("accountOpening");
    const info = ao && ao.account_opening ? ao.account_opening : null;
    if (!info) {
      aoBox.innerHTML = `<span class="text-gray-500">暂无开户信息</span>`;
    } else {
      const rows = [
        ["姓名", info.name || ""],
        ["银行", info.bank_name || ""],
        ["账户类型", info.account_type || ""],
        ["币种", info.currencies || ""],
        ["账号", info.account_number_masked || ""],
        ["身份证号", info.id_no_masked || ""],
        ["手机", info.phone || ""],
        ["邮箱", info.email || ""],
        ["地址", info.address || ""],
        ["职业/单位", info.employer || ""],
      ];
      const html = `
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <tbody>
              ${rows
                .map(
                  ([k, v]) => `
                <tr class="border-t border-gray-200 dark:border-gray-800">
                  <td class="px-2 py-1 text-gray-500">${k}</td>
                  <td class="px-2 py-1">${v || "-"}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
      aoBox.innerHTML = html;
    }
  } catch (e) {
    document.getElementById("raw").textContent = String(e);
  } finally {
    setTimeout(() => (status.textContent = ""), 1500);
  }
}

init();

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
    // Build simple list arrays from links to show chips
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
