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
  // Add a small info tooltip explaining diagnostic fields (f/s/c/n and matched_fields)
  const infoTitle =
    "诊断说明：f=归一化模糊分(0..1)，s=语义相似度(0..1)，c=合成分数(未归一化)，n=归一化合成分数(0..1)。matched_fields 列出触发加分的字段（例如 birth_date）。仅供分析参考。";
  title.innerHTML =
    '<span class="inline-flex w-4 h-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">图</span>' +
    `<span>基于图谱的匹配候选（${name || "查询"}）</span>` +
    ` <button type="button" aria-label="诊断说明" title="${infoTitle.replace(
      /\"/g,
      "&quot;"
    )}" class="ml-2 text-xs text-emerald-600/80 dark:text-emerald-300/80 hover:underline">` +
    '<svg class="w-3 h-3 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 20c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z"/></svg>' +
    "</button>";
  card.appendChild(title);
  const listEl = document.createElement("ul");
  listEl.className = "space-y-0.5";
  candidates.slice(0, 5).forEach((c, idx) => {
    const li = document.createElement("li");
    // Highlight the top candidate visually
    const baseClass =
      "flex items-start justify-between gap-2 border-t first:border-t-0 pt-1 first:pt-0 mt-1 first:mt-0";
    li.className =
      idx === 0
        ? baseClass + " border-indigo-500 bg-indigo-50/40 dark:bg-indigo-900/20"
        : baseClass + " border-emerald-100/60 dark:border-emerald-700/60";
    const left = document.createElement("div");
    left.className = "flex-1 min-w-0";
    const nameSpan = document.createElement("div");
    nameSpan.className = "font-medium truncate flex items-center gap-2";
    const label = c.name || c.node_id || "(未命名)";
    nameSpan.textContent = label;
    if (idx === 0) {
      const badge = document.createElement("span");
      badge.className =
        "ml-2 inline-flex items-center rounded-full bg-indigo-600 text-white px-2 py-0.5 text-[10px]";
      badge.textContent = "最匹配";
      nameSpan.appendChild(badge);
    }
    left.appendChild(nameSpan);
    const meta = document.createElement("div");
    meta.className = "text-[11px] text-emerald-700 dark:text-emerald-200/80";
    const score =
      typeof c.score === "number" ? `score=${c.score.toFixed(3)}` : "score=?";
    // include optional diagnostic fields when available
    const fuzzy =
      typeof c.fuzzy_score === "number"
        ? `f=${c.fuzzy_score.toFixed(3)}`
        : null;
    const sem =
      typeof c.semantic_score === "number"
        ? `s=${c.semantic_score.toFixed(3)}`
        : null;
    const comp =
      typeof c.composite_score === "number"
        ? `c=${c.composite_score.toFixed(3)}`
        : null;
    const norm =
      typeof c.normalized_score === "number"
        ? `n=${c.normalized_score.toFixed(3)}`
        : null;
    const diag = [fuzzy, sem, comp, norm].filter(Boolean).join(" ");
    const idText = c.node_id ? `[${c.node_id}]` : "";
    meta.textContent = `${idText} ${score}`.trim() + (diag ? ` · ${diag}` : "");
    left.appendChild(meta);
    if (Array.isArray(c.matched_fields) && c.matched_fields.length) {
      const mf = document.createElement("div");
      mf.className = "text-[11px] text-emerald-700/70 dark:text-emerald-200/60";
      mf.textContent = `matched: ${c.matched_fields.join(", ")}`;
      left.appendChild(mf);
    }
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
