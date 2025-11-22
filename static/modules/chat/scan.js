// scan.js
// Name scan + variant rendering helpers extracted from original chat.js
// Single-responsibility: fetch name scan data and render a result card.

export async function fetchNameScan(name) {
  const q = String(name || "").trim();
  if (!q) return null;
  try {
    const res = await fetch(`/name-scan?q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function extractBirthdate(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  let m = t.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/\b(\d{4})(\d{2})(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

// Internal stream container helper (kept local to avoid circular import)
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

export function renderNameScanCard(name, scan) {
  if (!scan) return;
  const stream = ensureStreamContainer();
  const card = document.createElement("section");
  card.className =
    "rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 shadow-sm";

  const head = document.createElement("div");
  head.className =
    "px-4 py-3 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between";
  const h = document.createElement("h3");
  h.className = "text-base font-semibold text-amber-900 dark:text-amber-50";
  h.textContent = `姓名扫描：${name}`;
  head.appendChild(h);
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "p-3 grid grid-cols-1 md:grid-cols-2 gap-3";

  // Left: fuzzy matches
  const left = document.createElement("div");
  const leftTitle = document.createElement("div");
  leftTitle.className = "text-sm font-medium mb-1";
  leftTitle.textContent = "内部实体模糊匹配";
  left.appendChild(leftTitle);
  const leftList = document.createElement("div");
  leftList.className = "space-y-1 text-xs text-gray-900 dark:text-gray-50";
  const efm = scan.entity_fuzzy_matches || [];
  if (!efm.length) {
    leftList.textContent = "暂无相似实体";
  } else {
    efm.forEach((m) => {
      const row = document.createElement("div");
      row.className =
        "border border-gray-200 dark:border-gray-700 rounded px-2 py-1";
      const type = m.type ? ` · ${m.type}` : "";
      const desc = m.description ? `\n${m.description}` : "";
      const matchBy = m.match_by ? ` · 匹配方式: ${m.match_by}` : "";
      row.textContent = `${m.name || "(无名称)"} [${m.id}]${type} (score=${
        m.score ?? "-"
      })${matchBy}${desc}`;
      leftList.appendChild(row);
    });
  }
  left.appendChild(leftList);

  // Right: watchlist hits + variants
  const right = document.createElement("div");
  const rightTitle = document.createElement("div");
  rightTitle.className = "text-sm font-medium mb-1";
  rightTitle.textContent = "本地名单命中";
  right.appendChild(rightTitle);
  const rightList = document.createElement("div");
  rightList.className = "space-y-1 text-xs text-gray-900 dark:text-gray-50";
  const hits = scan.watchlist_hits || [];
  if (!hits.length) {
    rightList.textContent = "暂无名单命中";
  } else {
    hits.forEach((w) => {
      const row = document.createElement("div");
      row.className =
        "border border-red-200 dark:border-red-700 rounded px-2 py-1";
      const risk = w.risk_level ? `风险等级: ${w.risk_level}` : "";
      const list = w.list ? `名单: ${w.list}` : "";
      const meta = [list, risk].filter(Boolean).join(" · ");
      const matchBy = w.match_by ? ` · 匹配方式: ${w.match_by}` : "";
      row.textContent = `${w.name} (${w.type || ""})${matchBy}${
        meta ? " - " + meta : ""
      }${w.notes ? "\n" + w.notes : ""}`;
      rightList.appendChild(row);
    });
  }
  right.appendChild(rightList);

  // Variant expansion block
  const exp = scan.variant_expansion || null;
  if (exp) {
    const llmBox = document.createElement("div");
    llmBox.className = "mt-3 space-y-2";
    const vTitle = document.createElement("div");
    vTitle.className = "text-sm font-medium";
    vTitle.textContent = "LLM 生成变体";
    llmBox.appendChild(vTitle);
    const vList = document.createElement("div");
    vList.className = "flex flex-wrap gap-1 text-[11px]";
    const vs = Array.isArray(exp.variants) ? exp.variants : [];
    if (!vs.length) {
      const span = document.createElement("span");
      span.className = "text-xs text-gray-500";
      span.textContent = exp.error
        ? `变体生成失败：${exp.error}`
        : "未生成变体（可能未配置 LLM）";
      vList.appendChild(span);
    } else {
      vs.forEach((v) => {
        const tag = document.createElement("span");
        tag.className =
          "inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300";
        const type = v.type ? `/${v.type}` : "";
        const conf =
          v.confidence != null ? ` (${Math.round(v.confidence * 100)}%)` : "";
        tag.textContent = `${v.value}${type}${conf}`;
        vList.appendChild(tag);
      });
    }
    llmBox.appendChild(vList);

    // Hits via variants
    const vHits = scan.watchlist_hits_via_variants || [];
    const vHitTitle = document.createElement("div");
    vHitTitle.className = "text-sm font-medium";
    vHitTitle.textContent = "名单命中（按变体）";
    llmBox.appendChild(vHitTitle);
    const vHitList = document.createElement("div");
    vHitList.className = "space-y-1 text-xs text-gray-900 dark:text-gray-50";
    if (!vHits.length) {
      const span = document.createElement("span");
      span.className = "text-xs text-gray-500";
      span.textContent = "无额外命中";
      vHitList.appendChild(span);
    } else {
      vHits.forEach((w) => {
        const row = document.createElement("div");
        row.className =
          "border border-amber-200 dark:border-amber-700 rounded px-2 py-1";
        const via = w.via_variant
          ? ` · 通过变体: ${w.via_variant.value} (${w.via_variant.type || "-"})`
          : "";
        const risk = w.risk_level ? `风险等级: ${w.risk_level}` : "";
        const list = w.list ? `名单: ${w.list}` : "";
        const meta = [list, risk].filter(Boolean).join(" · ");
        row.textContent = `${w.name} (${w.type || ""})${via}${
          meta ? " - " + meta : ""
        }`;
        vHitList.appendChild(row);
      });
    }
    llmBox.appendChild(vHitList);
    right.appendChild(llmBox);
  }

  body.appendChild(left);
  body.appendChild(right);
  card.appendChild(body);
  stream.appendChild(card);
  return card;
}
