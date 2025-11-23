// Renders MCP (external provider) search results into the chat stream.
import { revealDashboard, loadFullDashboardAndSnapshot } from "./dashboard.js";

export function renderMcpResults(query, results, targetList) {
  const list =
    targetList || document.getElementById("chatMessages") || document.body;
  const card = document.createElement("div");
  card.className =
    "mt-2 mb-2 border border-slate-200 rounded-lg bg-white dark:bg-gray-900 px-3 py-2 max-w-2xl shadow-sm text-sm";
  const title = document.createElement("div");
  title.className = "font-semibold mb-1 flex items-center justify-between";
  title.textContent = `公开来源检索结果（${query || "查询"}）`;
  card.appendChild(title);

  const ul = document.createElement("ul");
  ul.className = "space-y-1";

  // add a small toolbar for batch actions
  const toolbar = document.createElement("div");
  toolbar.className = "flex items-center gap-2 mb-2";
  const selectAll = document.createElement("button");
  selectAll.type = "button";
  selectAll.className = "text-xs px-2 py-0.5 border rounded text-slate-600";
  selectAll.textContent = "全选";
  const clearAll = document.createElement("button");
  clearAll.type = "button";
  clearAll.className = "text-xs px-2 py-0.5 border rounded text-slate-600";
  clearAll.textContent = "清除选择";
  toolbar.appendChild(selectAll);
  toolbar.appendChild(clearAll);
  card.appendChild(toolbar);

  (results || []).forEach((r, idx) => {
    const li = document.createElement("li");
    li.className =
      "flex items-start justify-between gap-2 border-t first:border-t-0 pt-2";
    const left = document.createElement("div");
    left.className = "flex-1 min-w-0";

    // checkbox for batch selection
    const cbWrap = document.createElement("label");
    cbWrap.className = "inline-flex items-center gap-2 w-full";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.idx = String(idx);
    cb.className = "shrink-0";
    cbWrap.appendChild(cb);

    const info = document.createElement("div");
    info.className = "flex-1 min-w-0";
    const name = document.createElement("div");
    name.className = "font-medium truncate";
    name.textContent = r.name || r.title || "(无名)";
    info.appendChild(name);
    const meta = document.createElement("div");
    meta.className = "text-[12px] text-slate-600 dark:text-slate-300";
    meta.textContent = `${r.source || "外部"} · score=${
      r.match_score || r.match_score === 0 ? String(r.match_score) : "?"
    }`;
    info.appendChild(meta);
    if (r.snippet) {
      const sn = document.createElement("div");
      sn.className =
        "text-[12px] text-slate-700 dark:text-slate-200 line-clamp-2 mt-1";
      sn.textContent = r.snippet;
      info.appendChild(sn);
    }

    cbWrap.appendChild(info);
    left.appendChild(cbWrap);
    li.appendChild(left);

    const actions = document.createElement("div");
    actions.className = "shrink-0 flex flex-col items-end gap-1";
    if (r.url) {
      const open = document.createElement("a");
      open.href = r.url;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      open.className = "text-xs text-indigo-600 hover:underline";
      open.textContent = "打开来源";
      actions.appendChild(open);
    }
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className =
      "mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2 py-0.5 text-xs";
    importBtn.textContent = "导入为实体";
    importBtn.addEventListener("click", async () => {
      // direct import of single record: call backend import endpoint
      try {
        const resp = await fetch("/entities/import-mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: [r], name: r.name }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const ent = data.entity || (data && data.entity);
          if (ent && ent.id) {
            revealDashboard();
            const snap = await loadFullDashboardAndSnapshot(
              ent.id,
              ent.name || r.name,
              "Imported Dashboard"
            );
            if (snap && typeof snap.scrollIntoView === "function")
              snap.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        } else {
          console.warn("Import failed", await resp.text());
        }
      } catch (e) {
        console.error("Import error", e);
      }
    });
    actions.appendChild(importBtn);
    li.appendChild(actions);

    ul.appendChild(li);
  });

  // footer actions: adopt selected
  const footer = document.createElement("div");
  footer.className = "mt-3 flex items-center gap-2";
  const adoptBtn = document.createElement("button");
  adoptBtn.type = "button";
  adoptBtn.className =
    "inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-sm shadow-sm";
  adoptBtn.textContent = "采纳选中并生成画像";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className =
    "inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm";
  cancelBtn.textContent = "取消";

  footer.appendChild(adoptBtn);
  footer.appendChild(cancelBtn);
  card.appendChild(ul);
  card.appendChild(footer);
  list.appendChild(card);

  // select all / clear handlers
  selectAll.addEventListener("click", () => {
    ul.querySelectorAll('input[type="checkbox"]').forEach(
      (cb) => (cb.checked = true)
    );
  });
  clearAll.addEventListener("click", () => {
    ul.querySelectorAll('input[type="checkbox"]').forEach(
      (cb) => (cb.checked = false)
    );
  });

  cancelBtn.addEventListener("click", () => {
    card.remove();
  });

  adoptBtn.addEventListener("click", async () => {
    const checked = Array.from(
      ul.querySelectorAll('input[type="checkbox"]:checked')
    );
    if (!checked.length) return alert("请先选择要采纳的候选");
    const selected = checked.map((cb) => {
      const idx = parseInt(cb.dataset.idx, 10);
      return results[idx];
    });
    try {
      const resp = await fetch("/entities/import-mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: selected, name: query }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        console.error("Import failed", txt);
        alert("导入失败，请查看控制台");
        return;
      }
      const data = await resp.json();
      const ent = data.entity;
      if (ent && ent.id) {
        revealDashboard();
        const snap = await loadFullDashboardAndSnapshot(
          ent.id,
          ent.name || query,
          "Imported Dashboard"
        );
        if (snap && typeof snap.scrollIntoView === "function") {
          snap.scrollIntoView({ behavior: "smooth", block: "center" });
          snap.classList.add("ring-2", "ring-blue-300");
          setTimeout(
            () => snap.classList.remove("ring-2", "ring-blue-300"),
            1800
          );
        }
      }
    } catch (e) {
      console.error("Batch import error", e);
      alert("导入发生错误，请查看控制台");
    }
  });

  return card;
}
