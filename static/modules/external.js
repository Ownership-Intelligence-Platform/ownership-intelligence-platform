// External lookup module: fetch mock aggregated external info when no internal match

function escapeHtml(s) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function hideCanonicalPanels() {
  ["dashboardSection", "entityInfoSection", "controlsSection"].forEach((id) =>
    document.getElementById(id)?.classList.add("hidden")
  );
}

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

function renderProviderCard(p) {
  const title = `${escapeHtml(
    p.name
  )} <span class="text-xs opacity-70">(${escapeHtml(p.type || "")})</span>`;
  const items = (p.matches || []).map((m) => {
    const name = escapeHtml(m.name || "-");
    const bd = escapeHtml(m.birthdate || "");
    const score =
      typeof m.score === "number" ? (m.score * 100).toFixed(0) + "%" : "";
    const summary = escapeHtml(m.summary || "");
    const url = m.source_url
      ? `<a class="text-indigo-600 hover:underline" target="_blank" href="${m.source_url}">来源</a>`
      : "";
    return `<li class="py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div class="text-sm font-medium">${name}${bd ? ` · ${bd}` : ""}${
      score ? ` · 置信度 ${score}` : ""
    }</div>
      <div class="text-xs text-gray-600 dark:text-gray-400">${summary} ${url}</div>
    </li>`;
  });
  return `<div class="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800 font-semibold">${title}</div>
    <ul class="p-3">${
      items.join("") || '<li class="text-sm text-gray-500">无结果</li>'
    }</ul>
  </div>`;
}

function renderExternal(data) {
  // Render as a chat-style card appended after the conversation
  const stream = ensureStreamContainer();
  const wrapper = document.createElement("section");
  wrapper.className =
    "rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm chat-external-card";
  const head = document.createElement("div");
  head.className =
    "px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between";
  const h = document.createElement("h3");
  h.className = "text-base font-semibold";
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  h.textContent = `外部公开信息检索 · ${hh}:${mm}`;
  head.appendChild(h);
  wrapper.appendChild(head);
  const body = document.createElement("div");
  body.className = "p-4 text-sm text-gray-700 dark:text-gray-200 space-y-4";

  const name = escapeHtml(data?.query?.name || "");
  const bd = escapeHtml(data?.query?.birthdate || "");
  const summary = escapeHtml(data?.summary || "");
  const providers = data?.providers || [];
  const citations = data?.citations || [];
  const provHtml = providers.map(renderProviderCard).join("\n");
  const citeHtml =
    citations
      .map(
        (c) =>
          `<li class="truncate"><a class="text-indigo-600 hover:underline" target="_blank" href="${escapeHtml(
            c.url
          )}">${escapeHtml(c.title || c.url)}</a></li>`
      )
      .join("") || '<li class="text-sm text-gray-500">无</li>';
  body.innerHTML = `
    <div class="mb-2 text-gray-600 dark:text-gray-300">查询：<strong>${name}</strong>${
    bd ? ` · ${bd}` : ""
  } · 来自公开渠道（当前为模拟数据）</div>
    ${
      summary
        ? `<div class="text-gray-700 dark:text-gray-200">${summary}</div>`
        : ""
    }
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">${provHtml}</div>
    <div>
      <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">参考链接</div>
      <ul class="list-disc list-inside space-y-1">${citeHtml}</ul>
    </div>
  `;
  wrapper.appendChild(body);
  stream.appendChild(wrapper);
  wrapper.scrollIntoView({ behavior: "smooth", block: "start" });
}

export async function externalLookup(name, birthdate) {
  try {
    hideCanonicalPanels();
    const u = `/external/lookup?name=${encodeURIComponent(name)}${
      birthdate ? `&birthdate=${encodeURIComponent(birthdate)}` : ""
    }`;
    const res = await fetch(u);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`外部检索失败：${res.status} ${txt}`);
    }
    const data = await res.json();
    renderExternal(data);
  } catch (e) {
    // Render an error card in stream
    const stream = ensureStreamContainer();
    const card = document.createElement("section");
    card.className =
      "rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 shadow-sm p-4 text-sm text-rose-900 dark:text-rose-100";
    card.textContent = `外部检索出错：${e}`;
    stream.appendChild(card);
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
