// chat/personResolverCard.js
// Renders the compact person resolver candidate card.
import { revealDashboard, loadFullDashboardAndSnapshot } from "./dashboard.js";
import { showLoading, hideLoading } from "../utils.js";

export function renderPersonResolverCard(name, candidates, targetList) {
  if (!candidates || !candidates.length) return;
  const list =
    targetList || document.getElementById("chatMessages") || document.body;

  const card = document.createElement("div");
  // Updated: Wider card (w-full, max-w-4xl), professional styling (white bg, shadow, rounded)
  card.className =
    "mt-4 mb-4 w-full  mx-auto border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden font-sans";

  // Header Section
  const header = document.createElement("div");
  header.className =
    "px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between";

  const titleGroup = document.createElement("div");
  titleGroup.className = "flex items-center gap-2";
  titleGroup.innerHTML = `
    <div class="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-md text-emerald-600 dark:text-emerald-400">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
    </div>
    <div>
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">实体匹配结果</h3>
      <p class="text-xs text-gray-500 dark:text-gray-400">查询: "${
        name || "未知"
      }" · 找到 ${candidates.length} 个相关结果</p>
    </div>
  `;
  header.appendChild(titleGroup);

  // Diagnostic tooltip
  const infoTitle =
    "诊断说明：f=归一化模糊分(0..1)，s=语义相似度(0..1)，c=合成分数(未归一化)，n=归一化合成分数(0..1)。matched_fields 列出触发加分的字段。";
  const helpBtn = document.createElement("button");
  helpBtn.type = "button";
  helpBtn.className =
    "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors";
  helpBtn.title = infoTitle;
  helpBtn.innerHTML =
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 20c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z"/></svg>';
  header.appendChild(helpBtn);

  card.appendChild(header);

  // Content List
  const listEl = document.createElement("div");
  listEl.className = "divide-y divide-gray-100 dark:divide-gray-700";

  candidates.slice(0, 5).forEach((c, idx) => {
    const isTop = idx === 0;
    const item = document.createElement("div");
    // Highlight top candidate
    item.className = isTop
      ? "p-4 bg-blue-50/40 dark:bg-blue-900/10"
      : "p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors";

    const grid = document.createElement("div");
    grid.className = "flex flex-col sm:flex-row gap-4";

    // Left Column: Info
    const infoCol = document.createElement("div");
    infoCol.className = "flex-1 min-w-0";

    // Name & ID
    const nameRow = document.createElement("div");
    nameRow.className = "flex items-center flex-wrap gap-2 mb-1";

    const nameEl = document.createElement("span");
    nameEl.className = isTop
      ? "text-base font-bold text-gray-900 dark:text-white"
      : "text-sm font-medium text-gray-800 dark:text-gray-200";
    nameEl.textContent = c.name || c.node_id || "(未命名)";
    nameRow.appendChild(nameEl);

    if (isTop) {
      const badge = document.createElement("span");
      badge.className =
        "px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wide";
      badge.textContent = "Best Match";
      nameRow.appendChild(badge);
    }

    const idBadge = document.createElement("span");
    idBadge.className =
      "font-mono text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600";
    idBadge.textContent = c.node_id;
    nameRow.appendChild(idBadge);

    infoCol.appendChild(nameRow);

    // Details: Score & Matched Fields
    const detailsRow = document.createElement("div");
    detailsRow.className =
      "mt-2 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-gray-600 dark:text-gray-400";

    // Score - use normalized_score (or composite_score fallback) so similar raw scores like 1.0 show meaningful differences
    const displayBase =
      typeof c.normalized_score === "number"
        ? c.normalized_score
        : typeof c.composite_score === "number"
        ? c.composite_score
        : c.score;
    const scoreVal =
      typeof displayBase === "number" ? displayBase.toFixed(3) : "?";
    const barPct = Math.min(
      ((c.normalized_score ?? c.composite_score ?? c.score) || 0) * 100,
      100
    );
    const scoreEl = document.createElement("div");
    scoreEl.className = "flex items-center gap-1.5";
    scoreEl.innerHTML = `
      <div class="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div class="h-full ${
          isTop ? "bg-blue-500" : "bg-emerald-500"
        }" style="width: ${barPct}%"></div>
      </div>
      <span class="font-medium">分数: ${scoreVal}</span>
    `;
    detailsRow.appendChild(scoreEl);

    // Matched Fields
    if (Array.isArray(c.matched_fields) && c.matched_fields.length) {
      const matchEl = document.createElement("div");
      matchEl.className = "flex items-center gap-1";
      matchEl.innerHTML = `<span class="text-gray-400">Matched:</span>`;
      c.matched_fields.forEach((f) => {
        const tag = document.createElement("span");
        tag.className =
          "px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 text-[10px]";
        tag.textContent = f;
        matchEl.appendChild(tag);
      });
      detailsRow.appendChild(matchEl);
    }
    infoCol.appendChild(detailsRow);

    // Diagnostic Scores (Subtle)
    // Diagnostic scores with Chinese meanings
    const diagParts = [];
    if (typeof c.fuzzy_score === "number")
      diagParts.push(`F(模糊分)=${c.fuzzy_score.toFixed(2)}`);
    if (typeof c.semantic_score === "number")
      diagParts.push(`S(语义相似度)=${c.semantic_score.toFixed(2)}`);
    if (typeof c.normalized_score === "number")
      diagParts.push(`N(归一化合成分数)=${c.normalized_score.toFixed(3)}`);
    const diag = diagParts.join(" · ");

    if (diag) {
      const diagRow = document.createElement("div");
      diagRow.className = "mt-1 text-[10px] text-gray-400 font-mono opacity-75";
      diagRow.textContent = diag;
      infoCol.appendChild(diagRow);
      // small legend (中文解释) to make meanings clear
      const legendRow = document.createElement("div");
      legendRow.className =
        "mt-0.5 text-[10px] text-gray-400 font-sans opacity-70";
      legendRow.textContent =
        "说明: F=模糊分, S=语义相似度, N=归一化合成分数 (0..1)";
      infoCol.appendChild(legendRow);
    }

    // Details Section (New)
    if (c.details) {
      const d = c.details;
      const detailsGrid = document.createElement("div");
      detailsGrid.className =
        "mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-3 rounded border border-gray-100 dark:border-gray-700";

      // Helper to add field
      const addField = (label, value) => {
        if (!value) return;
        const row = document.createElement("div");
        row.className = "flex items-start gap-2";
        row.innerHTML = `<span class="shrink-0 font-medium text-gray-500 dark:text-gray-400 w-16 text-right">${label}:</span> <span class="break-all font-medium text-gray-800 dark:text-gray-200">${value}</span>`;
        detailsGrid.appendChild(row);
      };

      if (d.basic_info) {
        addField("性别", d.basic_info.gender);
        addField("出生日期", d.basic_info.birth_date);
        addField("国籍", d.basic_info.nationality);
        addField("居住地", d.basic_info.residential_address);
      }

      if (d.id_info) {
        // Mask ID numbers
        Object.entries(d.id_info).forEach(([k, v]) => {
          if (typeof v === "string") {
            // simple mask
            const masked =
              v.length > 8
                ? v.substring(0, 4) + "****" + v.substring(v.length - 4)
                : v;
            addField(k, masked);
          }
        });
      }

      if (d.job_info) {
        if (d.job_info.roles && d.job_info.roles.length) {
          addField("职位", d.job_info.roles.join(", "));
        }
        if (d.job_info.employers && d.job_info.employers.length) {
          addField("雇主", d.job_info.employers.join(", "));
        }
        // Fallback
        if (d.job_info.occupation && !d.job_info.roles)
          addField("职业", d.job_info.occupation);
        if (d.job_info.employer && !d.job_info.employers)
          addField("雇主", d.job_info.employer);
      }

      if (d.network_info) {
        if (
          d.network_info.known_associates &&
          d.network_info.known_associates.length
        ) {
          addField("关联方", d.network_info.known_associates.join(", "));
        }
      }

      if (d.risk_profile) {
        if (d.risk_profile.risk_factors && d.risk_profile.risk_factors.length) {
          const factors = d.risk_profile.risk_factors
            .map((f) => f.replace(/\|/g, ", "))
            .join("; ");
          addField("风险因素", factors);
        }
      }

      if (d.description) {
        const descRow = document.createElement("div");
        descRow.className =
          "col-span-1 sm:col-span-2 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 flex gap-2";
        descRow.innerHTML = `<span class="shrink-0 font-medium text-gray-500 dark:text-gray-400 w-16 text-right">描述:</span> <span class="italic text-gray-600 dark:text-gray-400">${d.description}</span>`;
        detailsGrid.appendChild(descRow);
      }

      if (detailsGrid.children.length > 0) {
        infoCol.appendChild(detailsGrid);
      } else if (c.evidence) {
        // Fallback to evidence if details are empty
        const evRow = document.createElement("div");
        evRow.className =
          "mt-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2 rounded border border-gray-100 dark:border-gray-700 leading-relaxed";
        evRow.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-200">Evidence:</span> ${c.evidence}`;
        infoCol.appendChild(evRow);
      }
    } else if (c.evidence) {
      const evRow = document.createElement("div");
      evRow.className =
        "mt-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2 rounded border border-gray-100 dark:border-gray-700 leading-relaxed";
      evRow.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-200">Evidence:</span> ${c.evidence}`;
      infoCol.appendChild(evRow);
    }

    grid.appendChild(infoCol);

    // Right Column: Actions
    if (c.node_id && /^P\d+$/i.test(c.node_id)) {
      const actionCol = document.createElement("div");
      actionCol.className =
        "flex flex-row sm:flex-col gap-2 items-start sm:items-end justify-start sm:justify-center min-w-[130px]";

      if (isTop) {
        const dashboardBtn = document.createElement("button");
        dashboardBtn.type = "button";
        dashboardBtn.className =
          "w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-sm transition-colors";
        dashboardBtn.innerHTML = `
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                <span>Dashboard</span>
            `;
        dashboardBtn.addEventListener("click", async () => {
          showLoading("正在加载 Dashboard...");
          try {
            revealDashboard();
            const snap = await loadFullDashboardAndSnapshot(
              c.node_id,
              c.name || c.node_id,
              "Dashboard 快照"
            );
            if (snap && typeof snap.scrollIntoView === "function") {
              snap.scrollIntoView({ behavior: "smooth", block: "center" });
              snap.classList.add("ring-2", "ring-blue-300");
              setTimeout(
                () => snap.classList.remove("ring-2", "ring-blue-300"),
                1800
              );
            }
          } catch (err) {
            console.error("Failed to load dashboard snapshot:", err);
          } finally {
            hideLoading();
          }
        });
        actionCol.appendChild(dashboardBtn);
      }

      const networkBtn = document.createElement("button");
      networkBtn.type = "button";
      // If top, secondary style. If not top, primary style (emerald)
      networkBtn.className = `w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 ${
        isTop
          ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          : "bg-emerald-600 text-white hover:bg-emerald-700"
      } text-xs font-medium rounded-md shadow-sm transition-colors`;
      networkBtn.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
            <span>关系图谱</span>
        `;
      networkBtn.addEventListener("click", () => {
        const url = `/static/person_network.html?person=${encodeURIComponent(
          c.node_id
        )}`;
        window.open(url, "_blank");
      });
      actionCol.appendChild(networkBtn);

      grid.appendChild(actionCol);
    }

    item.appendChild(grid);
    listEl.appendChild(item);
  });

  card.appendChild(listEl);
  list.appendChild(card);
}
