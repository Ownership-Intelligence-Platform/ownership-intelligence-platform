import { val, setStatus } from "./init.js";

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      if (data && data.detail) msg = JSON.stringify(data.detail);
    } catch {
      // ignore
    }
    throw new Error(`Request failed: ${msg}`);
  }
  return res.json();
}

function renderList(container, items, renderItem) {
  container.innerHTML = "";
  if (!items || !items.length) {
    const empty = document.createElement("div");
    empty.className = "text-sm text-gray-500";
    empty.textContent = "暂无记录";
    container.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "border-b border-gray-200 py-1 text-sm";
    row.innerHTML = renderItem(item);
    container.appendChild(row);
  });
}

async function runNameScan() {
  const name = val("nameScanInput");
  if (!name) {
    alert("请输入要扫描的姓名或实体名称");
    return;
  }
  try {
    setStatus("正在进行姓名扫描…", 0);
  } catch {
    // setStatus may not exist on all pages
  }

  const url = `/name-scan?q=${encodeURIComponent(name)}`;
  let data;
  try {
    data = await getJson(url);
  } catch (e) {
    alert(`姓名扫描失败: ${e}`);
    try {
      setStatus(`姓名扫描失败: ${e}`, 1);
    } catch {
      // ignore
    }
    return;
  }

  const inputEl = document.getElementById("nameScanInputEcho");
  if (inputEl) inputEl.textContent = data.input || name;

  const entityList = document.getElementById("nameScanEntities");
  const watchList = document.getElementById("nameScanWatchlist");

  if (entityList) {
    renderList(entityList, data.entity_fuzzy_matches || [], (m) => {
      const type = m.type ? ` · ${m.type}` : "";
      const desc = m.description
        ? `<div class=\"text-xs text-gray-500\">${m.description}</div>`
        : "";
      return `<div><strong>${m.name || "(无名称)"}</strong> [${
        m.id
      }]${type} <span class=\"ml-2 text-xs text-gray-400\">score=${
        m.score ?? "-"
      }</span>${desc}</div>`;
    });
  }

  if (watchList) {
    renderList(watchList, data.watchlist_hits || [], (w) => {
      const risk = w.risk_level ? `风险等级: ${w.risk_level}` : "";
      const list = w.list ? `名单: ${w.list}` : "";
      const meta = [list, risk].filter(Boolean).join(" · ");
      const notes = w.notes
        ? `<div class=\"text-xs text-gray-500\">${w.notes}</div>`
        : "";
      return `<div><strong>${
        w.name
      }</strong> <span class=\"ml-2 text-xs text-red-500\">${
        w.type || ""
      }</span><div class=\"text-xs text-gray-600\">${meta}</div>${notes}</div>`;
    });
  }

  try {
    setStatus("姓名扫描完成", 1);
  } catch {
    // ignore
  }
}

// Attach handler if the page has the button
const btn = document.getElementById("btnNameScan");
if (btn) {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    runNameScan();
  });
}

export { runNameScan };
