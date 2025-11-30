// dashboard.js
// Snapshot + dashboard loading helpers separated from chat orchestrator.
// Responsibilities: hide canonical panels, clone sections, load data, create snapshot.

import { loadEntityInfo } from "../entities.js";
import { loadLayers } from "../layers.js";
import { loadAccounts } from "../accounts.js";
import { loadTransactions } from "../transactions.js";
import { loadGuarantees } from "../guarantees.js";
import { loadSupplyChain } from "../supplyChain.js";
import { loadEmployment } from "../employment.js";
import { loadLocations } from "../locations.js";
import { loadNews } from "../news.js";
import { analyzeRisks } from "../risks.js";
import { loadPenetration } from "../penetration.js";
import { loadPersonOpening } from "../personOpening.js";
import { loadPersonNetwork as loadPersonNetworkEmbed } from "../personNetworkEmbed.js";
import { loadDashboardCards } from "../partials.js";

function ensureStreamContainer() {
  let stream = document.getElementById("chatTurnStream");
  if (!stream) {
    const right = document.getElementById("rightPanel") || document.body;
    stream = document.createElement("section");
    stream.id = "chatTurnStream";
    stream.className = "flex flex-col gap-4";
    right.appendChild(stream);
  }
  return stream;
}

export function hideCanonicalPanels() {
  [
    "chatTranscriptSection",
    "controlsSection",
    "entityInfoSection",
    "dashboardSection",
  ].forEach((id) => document.getElementById(id)?.classList.add("hidden"));
}

function stripIdsDeep(root) {
  if (!root) return;
  if (root.nodeType === 1 && root.hasAttribute("id"))
    root.removeAttribute("id");
  root.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
}

function clonedSection(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const clone = el.cloneNode(true);
  clone.classList.remove("hidden");
  stripIdsDeep(clone);
  return clone;
}

export function createDashboardSnapshotCard(titleText, entityId, options = {}) {
  const stream = ensureStreamContainer();
  const wrapper = document.createElement("section");
  wrapper.className =
    "rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm chat-dashboard-snapshot";
  const head = document.createElement("div");
  head.className =
    "px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between";
  const h = document.createElement("h3");
  h.className = "text-base font-semibold";
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const subtitle = entityId ? ` · ${entityId}` : "";
  h.textContent = `${titleText || "Dashboard"}${subtitle} · ${hh}:${mm}`;
  head.appendChild(h);
  wrapper.appendChild(head);
  const body = document.createElement("div");
  body.className = "p-3";
  const controlsClone = clonedSection("controlsSection");
  // option: hideEntityInfo will skip cloning the entity info section
  const infoClone = options.hideEntityInfo
    ? null
    : clonedSection("entityInfoSection");
  const grid = document.getElementById("dashboardSection");
  const gridClone = grid ? grid.cloneNode(true) : document.createElement("div");
  gridClone.classList.remove("hidden");
  stripIdsDeep(gridClone);
  if (controlsClone) body.appendChild(controlsClone);
  if (infoClone) body.appendChild(infoClone);

  // option: allow excluding specific card element IDs from the cloned grid
  if (Array.isArray(options.excludeCardIds) && options.excludeCardIds.length) {
    options.excludeCardIds.forEach((id) => {
      try {
        const el = gridClone.querySelector(`#${id}`);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      } catch (_) {}
    });
  }
  // If mock data requested, inject realistic-looking mock content into common card containers
  if (options.mockData) {
    try {
      // Employment list mock
      const emp = gridClone.querySelector('#employmentList');
      if (emp) {
        emp.innerHTML = `
          <ul class="list-disc list-inside">
            <li><strong>上海星辰云计算技术有限公司</strong> — 董事/总经理（2019-至今）</li>
            <li><strong>成都昊宇科技有限公司</strong> — 董员（2015-2019）</li>
            <li><strong>上海数据服务有限公司</strong> — 顾问（2012-2015）</li>
          </ul>
          <div class="mt-2 text-[12px] text-gray-500">来源：工商登记、企业年报汇总（示例数据）</div>
        `;
      }

      // News list mock
      const news = gridClone.querySelector('#newsList');
      if (news) {
        news.innerHTML = `
          <ul class="space-y-2">
            <li><a class="font-medium text-indigo-600" href="#">上海星辰云获千万元B轮融资，聚焦云计算服务</a><div class="text-[12px] text-gray-500">2024-08-12 · 来源：示例财经</div></li>
            <li><a class="font-medium text-indigo-600" href="#">董事长李贵芳被评为优秀企业家</a><div class="text-[12px] text-gray-500">2023-11-03 · 来源：示例新闻</div></li>
            <li><a class="font-medium text-indigo-600" href="#">公司参与的供应链合作引发关注</a><div class="text-[12px] text-gray-500">2022-06-18 · 来源：行业观察</div></li>
          </ul>
        `;
      }

      // Risk mock
      const risk = gridClone.querySelector('#riskResults');
      if (risk) {
        risk.innerHTML = `
          <div class="mb-2"><h4 class="font-semibold">负面新闻</h4><ul class="mt-1"><li>无显著负面报道</li></ul></div>
          <div class="mb-2"><h4 class="font-semibold">敏感行为</h4><ul class="mt-1"><li>与高风险供应商存在交易（示例）</li></ul></div>
          <div class="text-sm text-gray-600">综合风险评分（示例）： <span class="inline-block px-2 py-0.5 bg-amber-200 rounded">2.4 / 10</span></div>
        `;
      }

      // Person relations mock (cards)
      const rel = gridClone.querySelector('#personRelationsHomeCard');
      if (rel) {
        rel.innerHTML = '';
        const items = [
          { name: '张三', role: '同事', note: 'CTO' },
          { name: '王五', role: '股东', note: '间接持股' },
          { name: '赵六', role: '合伙人', note: '项目合伙' },
        ];
        items.forEach((it) => {
          const d = document.createElement('div');
          d.className = 'p-2 border rounded text-sm bg-white dark:bg-gray-900';
          d.innerHTML = `<div class="font-medium">${it.name}</div><div class="text-[12px] text-gray-500">${it.role} · ${it.note}</div>`;
          rel.appendChild(d);
        });
      }

      // Person network simple SVG mock
      const graph = gridClone.querySelector('#personNetworkHomeGraph');
      if (graph) {
        graph.innerHTML = '';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '420');
        svg.setAttribute('viewBox', '0 0 600 300');
        svg.innerHTML = `
          <line x1="100" y1="150" x2="300" y2="80" stroke="#cbd5e1" stroke-width="2" />
          <line x1="300" y1="80" x2="500" y2="150" stroke="#cbd5e1" stroke-width="2" />
          <circle cx="100" cy="150" r="28" fill="#60a5fa" />
          <circle cx="300" cy="80" r="28" fill="#34d399" />
          <circle cx="500" cy="150" r="28" fill="#f59e0b" />
          <text x="100" y="155" font-size="12" text-anchor="middle" fill="#fff">李贵芳</text>
          <text x="300" y="85" font-size="12" text-anchor="middle" fill="#fff">张三</text>
          <text x="500" y="155" font-size="12" text-anchor="middle" fill="#fff">王五</text>
        `;
        graph.appendChild(svg);
      }
    } catch (e) {
      console.warn('mockData injection failed', e);
    }
  }
  body.appendChild(gridClone);
  wrapper.appendChild(body);
  stream.appendChild(wrapper);
  return wrapper;
}

// Lightweight drag for cloned SVG snapshots. We don't need simulation
// behavior here — just allow manual translate of node groups so the
// snapshot feels interactive. Uses Pointer Events for cross-device support.
function attachSimpleDragToSnapshot(rootEl) {
  if (!rootEl) return;
  const svgs = Array.from(rootEl.querySelectorAll("svg"));
  if (!svgs.length) return;

  svgs.forEach((svg) => {
    try {
      svg.style.touchAction = "none";
    } catch (_) {}

    // pick candidate node groups: g elements that contain a circle or rect
    const groups = Array.from(svg.querySelectorAll("g")).filter((g) =>
      g.querySelector("circle,rect,text,title")
    );

    // helper to parse existing translate() on group transform attribute
    const parseTranslate = (t) => {
      if (!t) return [0, 0];
      const m = /translate\(([-0-9.]+)\s*,?\s*([-0-9.]+)\)/.exec(t);
      if (m) return [parseFloat(m[1]), parseFloat(m[2])];
      return [0, 0];
    };

    // Precompute group centers and map line endpoints to nearest groups so
    // we can update line endpoints when a group is dragged. Also build a
    // neighbor index so we can apply a lightweight spring to adjacent nodes
    // for an elastic feel in snapshot mode.
    const groupInfos = groups.map((g) => {
      const t = g.getAttribute("transform");
      const [gx, gy] = parseTranslate(t);
      return {
        g,
        gx,
        gy,
        currentX: gx,
        currentY: gy,
        connections: [],
        neighbors: new Set(),
      };
    });

    const lines = Array.from(svg.querySelectorAll("line"));
    // associate each line endpoint to the nearest group (if within threshold)
    const threshold = 80; // px
    lines.forEach((line) => {
      const x1 = parseFloat(line.getAttribute("x1") || "0");
      const y1 = parseFloat(line.getAttribute("y1") || "0");
      const x2 = parseFloat(line.getAttribute("x2") || "0");
      const y2 = parseFloat(line.getAttribute("y2") || "0");

      const nearestIndex = (x, y) => {
        let best = -1;
        let bestDist = Infinity;
        for (let i = 0; i < groupInfos.length; i++) {
          const gi = groupInfos[i];
          const dx = gi.gx - x;
          const dy = gi.gy - y;
          const d = Math.hypot(dx, dy);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        }
        return bestDist <= threshold ? best : -1;
      };

      const sIdx = nearestIndex(x1, y1);
      const tIdx = nearestIndex(x2, y2);
      if (sIdx !== -1) {
        groupInfos[sIdx].connections.push({
          line,
          xAttr: "x1",
          yAttr: "y1",
          origX: x1,
          origY: y1,
        });
      }
      if (tIdx !== -1) {
        groupInfos[tIdx].connections.push({
          line,
          xAttr: "x2",
          yAttr: "y2",
          origX: x2,
          origY: y2,
        });
      }
      // register neighbors when both endpoints mapped to groups
      if (sIdx !== -1 && tIdx !== -1 && sIdx !== tIdx) {
        groupInfos[sIdx].neighbors.add(tIdx);
        groupInfos[tIdx].neighbors.add(sIdx);
      }
    });

    groupInfos.forEach((info) => {
      const g = info.g;
      // ensure pointer events are enabled on the group
      try {
        g.style.pointerEvents = "all";
        g.style.cursor = "grab";
      } catch (_) {}

      let dragging = false;
      let startX = 0,
        startY = 0;
      let origX = info.gx,
        origY = info.gy;

      const onPointerDown = (ev) => {
        ev.preventDefault();
        try {
          if (ev.target && ev.target.setPointerCapture)
            ev.target.setPointerCapture(ev.pointerId);
        } catch (_) {}
        dragging = true;
        startX = ev.clientX;
        startY = ev.clientY;
        // refresh original positions in case SVG was not static
        const t = g.getAttribute("transform");
        const [x, y] = parseTranslate(t);
        origX = x;
        origY = y;
        // capture original endpoint positions for connected lines
        info.connections.forEach((c) => {
          c._startX = parseFloat(c.line.getAttribute(c.xAttr) || "0");
          c._startY = parseFloat(c.line.getAttribute(c.yAttr) || "0");
        });
        g.style.cursor = "grabbing";
      };

      const onPointerMove = (ev) => {
        if (!dragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const nx = origX + dx;
        const ny = origY + dy;
        try {
          g.setAttribute("transform", `translate(${nx},${ny})`);
        } catch (_) {}
        // update connected line endpoints so links follow the group visually
        info.connections.forEach((c) => {
          try {
            const newX = (c._startX || 0) + dx;
            const newY = (c._startY || 0) + dy;
            c.line.setAttribute(c.xAttr, String(newX));
            c.line.setAttribute(c.yAttr, String(newY));
          } catch (_) {}
        });

        // Simple elastic effect: nudge immediate neighbors a fraction of the drag
        // so the graph looks springy. We move neighbor groups by a fraction
        // of the delta away from their original positions.
        const SPRING_FACTOR = 0.28; // how much neighbors follow (0..1)
        info.neighbors &&
          Array.from(info.neighbors).forEach((nIdx) => {
            try {
              const nb = groupInfos[nIdx];
              // compute target displacement for neighbor relative to its original
              const targetX = (nb.gx || 0) + (nx - origX) * SPRING_FACTOR;
              const targetY = (nb.gy || 0) + (ny - origY) * SPRING_FACTOR;
              nb.currentX = targetX;
              nb.currentY = targetY;
              nb.g.setAttribute(
                "transform",
                `translate(${targetX},${targetY})`
              );
              // update lines connected to neighbor
              nb.connections.forEach((c) => {
                try {
                  const dxn = targetX - (nb.gx || 0);
                  const dyn = targetY - (nb.gy || 0);
                  const newX =
                    (c._startX ||
                      parseFloat(c.line.getAttribute(c.xAttr) || "0")) + dxn;
                  const newY =
                    (c._startY ||
                      parseFloat(c.line.getAttribute(c.yAttr) || "0")) + dyn;
                  c.line.setAttribute(c.xAttr, String(newX));
                  c.line.setAttribute(c.yAttr, String(newY));
                } catch (_) {}
              });
            } catch (_) {}
          });
      };

      const endDrag = (ev) => {
        if (!dragging) return;
        dragging = false;
        try {
          if (ev && ev.target && ev.target.releasePointerCapture)
            ev.target.releasePointerCapture(ev.pointerId);
        } catch (_) {}
        g.style.cursor = "grab";
      };

      g.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      // also support mouse events fallback
      g.addEventListener("mousedown", onPointerDown);
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", endDrag);
    });
  });
}

export async function loadFullDashboardAndSnapshot(
  rootId,
  rawInput,
  snapshotTitle = "Dashboard",
  options = {}
) {
  const rootInput = document.getElementById("rootId");
  if (rootInput) rootInput.value = rootId;
  hideCanonicalPanels();
  console.log("[dashboard] loadFullDashboardAndSnapshot start", {
    rootId,
    rawInput,
  });
  try {
    const dashboardEl = document.getElementById("dashboardSection");
    // Determine if the dashboard was already loaded for this id BEFORE
    // attempting to inject card partials. If we check after injecting we
    // will always observe the dataset just set by loadDashboardCards and
    // incorrectly skip the data loaders.
    const dashboardAlreadyLoaded = !!(
      dashboardEl &&
      dashboardEl.dataset &&
      dashboardEl.dataset.loadedId === String(rootId || rawInput)
    );

    // Ensure the card partials are present for this rootId/rawInput.
    // This will inject person- or entity-specific partials as needed.
    await loadDashboardCards(rootId, rawInput);

    if (dashboardAlreadyLoaded) {
      console.log(
        "[dashboard] dashboard already loaded — skipping card loaders and will clone existing DOM for snapshot"
      );
    }
    const txDir =
      document.getElementById("txDirection")?.value?.trim() || "out";
    const gDir =
      document.getElementById("guaranteeDirection")?.value?.trim() || "out";
    const sDir =
      document.getElementById("supplyDirection")?.value?.trim() || "out";
    const role =
      document.getElementById("employmentRole")?.value?.trim() || "both";
    const newsLimit = parseInt(
      document.getElementById("riskNewsLimit")?.value || "5",
      10
    );

    // If the dashboard has already been injected and its cards loaded earlier
    // (e.g. by a prior user action), prefer cloning the existing DOM for the
    // snapshot rather than re-running the card loaders which may trigger
    // duplicate network requests or duplicate DOM injection.
    if (!dashboardAlreadyLoaded) {
      console.log("[dashboard] loading entity info and layers...");
      await loadEntityInfo(rootId);
      await loadLayers();

      const p1 = await Promise.allSettled([
        loadAccounts(rootId),
        loadTransactions(rootId, txDir),
        loadGuarantees(rootId, gDir),
        loadSupplyChain(rootId, sDir),
        loadEmployment(rootId, role),
        loadLocations(rootId),
        loadNews(rootId),
        analyzeRisks(rootId, newsLimit),
      ]);
      console.log(
        "[dashboard] primary loaders settled",
        p1.map((r) => ({
          status: r.status,
          reason: r.reason ? String(r.reason) : undefined,
        }))
      );
    } else {
      // still update entity info/layers if caller provided a new rootId value
      // but avoid reloading all card data
      try {
        await loadEntityInfo(rootId);
        await loadLayers();
      } catch (e) {
        console.warn(
          "[dashboard] non-blocking: failed to refresh entity info/layers",
          e
        );
      }
    }

    // Prefer using a canonical person ID when available for person-specific loaders.
    // Some call-sites pass a human-readable name as `rawInput` (e.g. "李辉").
    // If `rootId` is a person id (P...), prefer it; otherwise fall back to rawInput only
    // if it also looks like a person id.
    const personCandidate = /^P\w+/i.test(rootId)
      ? rootId
      : /^P\w+/i.test(rawInput || "")
      ? rawInput
      : null;

    const p2 = await Promise.allSettled([
      loadPenetration(),
      // optionally skip person opening loader when caller requests it
      personCandidate && !options.hidePersonOpening
        ? loadPersonOpening(personCandidate)
        : Promise.resolve(),
      personCandidate
        ? (async () => {
            const graphEl = document.getElementById("personNetworkHomeGraph");
            const relationsEl = document.getElementById(
              "personRelationsHomeCard"
            );
            if (graphEl || relationsEl)
              await loadPersonNetworkEmbed(personCandidate, {
                graphEl,
                relationsEl,
              });
          })()
        : Promise.resolve(),
    ]);
    console.log(
      "[dashboard] secondary loaders settled",
      p2.map((r) => ({
        status: r.status,
        reason: r.reason ? String(r.reason) : undefined,
      }))
    );
  } catch (_) {
    // Swallow partial failures; snapshot whatever is available.
  }
  // Wait briefly for person network rendering to settle so cloned snapshots
  // include final SVG transforms/coordinates. We listen for a custom
  // 'personNetworkReady' event dispatched by the renderer, with a timeout
  // fallback to avoid blocking.
  function waitForEvent(el, name, timeout = 1000) {
    return new Promise((resolve) => {
      if (!el) return resolve();
      let done = false;
      const on = () => {
        if (done) return;
        done = true;
        clearTimeout(tm);
        el.removeEventListener(name, on);
        resolve();
      };
      const tm = setTimeout(() => {
        if (done) return;
        done = true;
        try {
          el.removeEventListener(name, on);
        } catch (_) {}
        resolve();
      }, timeout);
      el.addEventListener(name, on);
    });
  }

  try {
    const graphEl = document.getElementById("personNetworkHomeGraph");
    if (graphEl) {
      // wait up to 1s for network ready event; this helps ensure transforms
      // are present on the canonical SVG before we clone it into the snapshot.
      await waitForEvent(graphEl, "personNetworkReady", 1000);
    }
  } catch (e) {
    /* swallow */
  }

  return createDashboardSnapshotCard(snapshotTitle, rootId, options);
}

export function revealDashboard() {
  // Intentionally no-op: canonical panels kept hidden; snapshots are appended.
}
