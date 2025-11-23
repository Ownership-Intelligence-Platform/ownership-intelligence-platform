// chat/personResolverCard.js
// Renders the compact person resolver candidate card.
export function renderPersonResolverCard(name, candidates, targetList) {
  if (!candidates || !candidates.length) return;
  const list =
    targetList || document.getElementById("chatMessages") || document.body;
  const card = document.createElement("div");
  card.className =
    "mt-2 mb-1 border border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-900/20 dark:border-emerald-500/50 rounded-xl text-xs sm:text-sm text-emerald-900 dark:text-emerald-50 px-3 py-2 shadow-sm max-w-2xl";
  const title = document.createElement("div");
  title.className = "font-semibold flex items-center gap-1 mb-1";
  title.innerHTML =
    '<span class="inline-flex w-4 h-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">图</span>' +
    `<span>基于图谱的匹配候选（${name || "查询"}）</span>`;
  card.appendChild(title);
  const listEl = document.createElement("ul");
  listEl.className = "space-y-0.5";
  candidates.slice(0, 5).forEach((c) => {
    const li = document.createElement("li");
    li.className =
      "flex items-start justify-between gap-2 border-t border-emerald-100/60 dark:border-emerald-700/60 first:border-t-0 pt-1 first:pt-0 mt-1 first:mt-0";
    const left = document.createElement("div");
    left.className = "flex-1 min-w-0";
    const nameSpan = document.createElement("div");
    nameSpan.className = "font-medium truncate";
    const label = c.name || c.node_id || "(未命名)";
    nameSpan.textContent = label;
    left.appendChild(nameSpan);
    const meta = document.createElement("div");
    meta.className = "text-[11px] text-emerald-700 dark:text-emerald-200/80";
    const score =
      typeof c.score === "number" ? `score=${c.score.toFixed(3)}` : "score=?";
    const idText = c.node_id ? `[${c.node_id}]` : "";
    meta.textContent = `${idText} ${score}`.trim();
    left.appendChild(meta);
    if (c.evidence) {
      const ev = document.createElement("div");
      ev.className =
        "text-[11px] text-emerald-800/80 dark:text-emerald-100/80 line-clamp-2";
      ev.textContent = c.evidence;
      left.appendChild(ev);
    }
    li.appendChild(left);
    if (c.node_id && /^P\d+$/i.test(c.node_id)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2.5 py-1 text-[11px] hover:bg-emerald-500 shadow-sm";
      btn.innerHTML =
        '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h10M7 12h4m1 4h5m-8 0a4 4 0 11-8 0 4 4 0 018 0zm10-4a4 4 0 11-8 0 4 4 0 018 0zm-10-8a4 4 0 11-8 0 4 4 0 018 0z"/></svg>' +
        "<span>人物网络</span>";
      btn.addEventListener("click", () => {
        const url = `/static/person_network.html?person=${encodeURIComponent(
          c.node_id
        )}`;
        window.open(url, "_blank");
      });
      li.appendChild(btn);
    }
    listEl.appendChild(li);
  });
  card.appendChild(listEl);
  list.appendChild(card);
}
