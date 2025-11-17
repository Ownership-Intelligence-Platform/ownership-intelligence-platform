// External lookup module: fetch mock aggregated external info when no internal match

function escapeHtml(s) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function hideDashboard() {
  document.getElementById("dashboardSection")?.classList.add("hidden");
}

function hideEntityInfoControls() {
  document.getElementById("entityInfoSection")?.classList.add("hidden");
  document.getElementById("controlsSection")?.classList.add("hidden");
}

function showExternalSection() {
  const sec = document.getElementById("externalSection");
  if (sec) sec.classList.remove("hidden");
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
  const host = document.getElementById("externalResults");
  if (!host) return;
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
  host.innerHTML = `
    <div class="mb-3 text-sm text-gray-600 dark:text-gray-300">查询：<strong>${name}</strong>${
    bd ? ` · ${bd}` : ""
  } · 数据来自公开网络，以下内容为模拟数据以展示界面</div>
    ${summary ? `<div class="mb-4 text-sm">${summary}</div>` : ""}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">${provHtml}</div>
    <div class="mt-4">
      <div class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">参考链接</div>
      <ul class="list-disc list-inside space-y-1">${citeHtml}</ul>
    </div>
  `;
}

export async function externalLookup(name, birthdate) {
  try {
    hideDashboard();
    hideEntityInfoControls();
    showExternalSection();
    const panel = document.getElementById("externalResults");
    if (panel) panel.textContent = "正在从公开渠道检索（模拟）…";
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
    const panel = document.getElementById("externalResults");
    if (panel) panel.textContent = `外部检索出错：${e}`;
  }
}
