// entitiesHelper.js
// Entity id extraction + chip rendering utilities.
import { loadFullDashboardAndSnapshot } from "./dashboard.js";

export function extractEntityIds(txt) {
  const ids = new Set();
  const re = /(E\d+|P\d+)/g;
  let m;
  while ((m = re.exec(txt))) ids.add(m[1]);
  return Array.from(ids);
}

export async function attachIdChipsBelowLastAssistant(ids, targetListEl) {
  if (!ids?.length) return;
  const list = targetListEl || document.getElementById("chatMessages");
  if (!list) return;
  const chipBox = document.createElement("div");
  chipBox.className =
    "px-3 py-2 rounded mb-2 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100";
  const title = document.createElement("div");
  title.className = "font-medium mb-1";
  title.textContent = "检测到实体：";
  chipBox.appendChild(title);
  const wrap = document.createElement("div");
  wrap.className = "flex flex-wrap gap-2";
  ids.forEach((id) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "inline-flex items-center rounded-full border border-gray-300 dark:border-gray-700 px-2.5 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-700";
    btn.textContent = id;
    btn.addEventListener("click", async () => {
      const root = document.getElementById("rootId");
      if (root) root.value = id;
      const snap = await loadFullDashboardAndSnapshot(id, id, "Dashboard 快照");
      snap?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    wrap.appendChild(btn);
  });
  chipBox.appendChild(wrap);
  list.appendChild(chipBox);
  if (list.parentElement)
    list.parentElement.scrollTop = list.parentElement.scrollHeight;
}
