// Core event wiring for dashboard/data-console actions.
// Keeps DOM listeners and orchestration separate from the entry file.

import { loadLayers } from "./layers.js";
import { loadDashboardCards } from "./partials.js";
import { loadNews } from "./news.js";
import { loadPenetration } from "./penetration.js";
import { populateMock, clearDb, importPersons } from "./db.js";
import { loadAccounts } from "./accounts.js";
import { loadTransactions } from "./transactions.js";
import { loadGuarantees } from "./guarantees.js";
import { loadSupplyChain } from "./supplyChain.js";
import { loadEmployment } from "./employment.js";
import { loadLocations } from "./locations.js";
import { loadPersonOpening } from "./personOpening.js";
import { analyzeRisks } from "./risks.js";
import { resolveEntityInput, tryResolveEntityInput } from "./utils.js";
import { loadEntityInfo } from "./entities.js";
import { loadPersonNetwork as loadPersonNetworkEmbed } from "./personNetworkEmbed.js";
import { externalLookup } from "./external.js";

async function autoLoadDashboardCards(id, rawInput) {
  // Accounts
  try {
    loadAccounts(id);
  } catch (_) {}

  // Transactions (respect current direction)
  try {
    const txDirEl = document.getElementById("txDirection");
    const txDir = txDirEl ? txDirEl.value.trim() : "out";
    loadTransactions(id, txDir);
  } catch (_) {}

  // Guarantees
  try {
    const gDirEl = document.getElementById("guaranteeDirection");
    const gDir = gDirEl ? gDirEl.value.trim() : "out";
    loadGuarantees(id, gDir);
  } catch (_) {}

  // Supply chain
  try {
    const sDirEl = document.getElementById("supplyDirection");
    const sDir = sDirEl ? sDirEl.value.trim() : "out";
    loadSupplyChain(id, sDir);
  } catch (_) {}

  // Employment
  try {
    const roleEl = document.getElementById("employmentRole");
    const role = roleEl ? roleEl.value.trim() : "both";
    loadEmployment(id, role);
  } catch (_) {}

  // Locations
  try {
    loadLocations(id);
  } catch (_) {}

  // News (respect current limit)
  try {
    loadNews(id);
  } catch (_) {}

  // Penetration graph
  try {
    loadPenetration();
  } catch (_) {}

  // Person account opening (use raw input which may be a person id)
  try {
    if (rawInput) {
      loadPersonOpening(rawInput);
    }
  } catch (_) {}

  // Person relationship network (only if looks like a person id e.g., P1)
  try {
    if (/^P\w+/i.test(rawInput)) {
      const graphEl = document.getElementById("personNetworkHomeGraph");
      const relationsEl = document.getElementById("personRelationsHomeCard");
      if (graphEl || relationsEl) {
        await loadPersonNetworkEmbed(rawInput, { graphEl, relationsEl });
      }
    }
  } catch (_) {}

  // Risk analysis (respect current news limit)
  try {
    const newsLimit = parseInt(
      document.getElementById("riskNewsLimit")?.value || "5",
      10
    );
    analyzeRisks(id, newsLimit);
  } catch (_) {}
}

function revealUI() {
  const controls = document.getElementById("controlsSection");
  const info = document.getElementById("entityInfoSection");
  const dash = document.getElementById("dashboardSection");
  const rightPanel = document.getElementById("rightPanel");
  const chatSection = document.getElementById("chatSection");
  controls?.classList.remove("hidden");
  info?.classList.remove("hidden");
  dash?.classList.remove("hidden");
  chatSection?.classList.add("motion-pop-left");
  rightPanel?.classList.add("motion-slide-in");
  // Hide external section if it was visible
  document.getElementById("externalSection")?.classList.add("hidden");
}

export function wireCoreEvents() {
  // Diagnostic: confirm core events wiring (helps when Console filters hide debug)
  try {
    console.log("wireCoreEvents: wiring core event handlers");
  } catch (_) {}
  // Temporary diagnostic: capture-phase click logger to help debug click propagation
  // Will log the raw event target and the nearest #exportRiskPdf ancestor when present.
  try {
    document.addEventListener(
      "click",
      (ev) => {
        try {
          const tgt =
            ev.target instanceof Element ? ev.target : ev.target.parentElement;
          // log concise info to avoid noisy dumps
          const summary = {
            tag: tgt?.tagName,
            id: tgt?.id || null,
            classes: tgt?.className || null,
            text:
              (tgt && tgt.textContent && tgt.textContent.trim().slice(0, 40)) ||
              null,
          };
          const nearest = tgt ? tgt.closest("#exportRiskPdf") : null;
          console.log(
            "[capture-click] target=",
            summary,
            " nearestExport=",
            Boolean(nearest)
          );
        } catch (e) {
          console.log("[capture-click] failed to summarise click", e);
        }
      },
      /* capture */ true
    );
  } catch (_e) {}
  // Populate / Clear
  document
    .getElementById("populate")
    ?.addEventListener("click", () => populateMock(loadLayers));
  document
    .getElementById("importPersons")
    ?.addEventListener("click", () => importPersons(loadLayers));
  document.getElementById("clearDb")?.addEventListener("click", clearDb);

  document.getElementById("mobileMenuButton")?.addEventListener("click", () => {
    const menu = document.getElementById("mobileMenu");
    const iconOpen = document.querySelector(
      "#mobileMenuButton svg:first-of-type"
    );
    const iconClose = document.querySelector(
      "#mobileMenuButton svg:last-of-type"
    );
    if (menu.classList.contains("hidden")) {
      menu.classList.remove("hidden");
      iconOpen.classList.add("hidden");
      iconClose.classList.remove("hidden");
    } else {
      menu.classList.add("hidden");
      iconOpen.classList.remove("hidden");
      iconClose.classList.add("hidden");
    }
  });

  // Mobile menu buttons
  document
    .getElementById("populate-mobile")
    ?.addEventListener("click", () => populateMock(loadLayers));
  document
    .getElementById("importPersons-mobile")
    ?.addEventListener("click", () => importPersons(loadLayers));
  document.getElementById("clearDb-mobile")?.addEventListener("click", clearDb);
  document
    .getElementById("themeToggle-mobile")
    ?.addEventListener("click", () =>
      document.getElementById("themeToggle").click()
    );

  // Load layers + auto-load dashboard cards
  document.getElementById("loadLayers")?.addEventListener("click", async () => {
    const rawInput = document.getElementById("rootId").value.trim();
    const id = await tryResolveEntityInput(rawInput);
    if (id) {
      document.getElementById("rootId").value = id;
      revealUI();
      // Show entity info panel first for quicker feedback
      loadEntityInfo(id);
      // Load core ownership layers
      loadLayers();
      // Then load the dashboard cards appropriate to the query (person vs entity)
      await loadDashboardCards(id, rawInput);
      // Then auto-load the dashboard data within those cards
      await autoLoadDashboardCards(id, rawInput);
    } else {
      // If the raw input looks like a Person id (e.g., P...), treat it as a person query
      if (/^P\w+/i.test(rawInput)) {
        // Use rawInput as the id for person-specific loaders
        const personId = rawInput;
        document.getElementById("rootId").value = personId;
        revealUI();
        // Load person-specific card partials and then populate them
        await loadDashboardCards(personId, personId);
        await autoLoadDashboardCards(personId, personId);
        return;
      }
      // Fallback to external lookup (ask for birthdate)
      const bd = prompt(
        "未找到内部实体。可从公开来源检索。请输入出生日期 (YYYY-MM-DD，可留空)：",
        ""
      );
      await externalLookup(rawInput, bd || "");
    }
  });

  // Individual cards / views
  document
    .getElementById("loadPenetration")
    ?.addEventListener("click", async () => {
      const raw = document.getElementById("rootId").value.trim();
      const id = await resolveEntityInput(raw);
      if (!id) return;
      document.getElementById("rootId").value = id;
      loadEntityInfo(id);
      loadPenetration();
    });

  document
    .getElementById("loadAccounts")
    ?.addEventListener("click", async () => {
      const raw = document.getElementById("rootId").value.trim();
      const id = await resolveEntityInput(raw);
      if (!id) return;
      document.getElementById("rootId").value = id;
      loadEntityInfo(id);
      loadAccounts(id);
    });

  document
    .getElementById("loadTransactions")
    ?.addEventListener("click", async () => {
      const raw = document.getElementById("rootId").value.trim();
      const id = await resolveEntityInput(raw);
      if (!id) return;
      document.getElementById("rootId").value = id;
      loadEntityInfo(id);
      const direction = document.getElementById("txDirection").value.trim();
      loadTransactions(id, direction);
    });

  document
    .getElementById("loadGuarantees")
    ?.addEventListener("click", async () => {
      const raw = document.getElementById("rootId").value.trim();
      const id = await resolveEntityInput(raw);
      if (!id) return;
      document.getElementById("rootId").value = id;
      loadEntityInfo(id);
      const direction = document
        .getElementById("guaranteeDirection")
        .value.trim();
      loadGuarantees(id, direction);
    });

  document
    .getElementById("loadSupplyChain")
    ?.addEventListener("click", async () => {
      const raw = document.getElementById("rootId").value.trim();
      const id = await resolveEntityInput(raw);
      if (!id) return;
      document.getElementById("rootId").value = id;
      loadEntityInfo(id);
      const direction = document.getElementById("supplyDirection").value.trim();
      loadSupplyChain(id, direction);
    });

  document
    .getElementById("loadEmployment")
    ?.addEventListener("click", async () => {
      const raw = document.getElementById("rootId").value.trim();
      const id = await resolveEntityInput(raw);
      if (!id) return;
      document.getElementById("rootId").value = id;
      loadEntityInfo(id);
      const role = document.getElementById("employmentRole").value.trim();
      loadEmployment(id, role);
    });

  document
    .getElementById("loadLocations")
    ?.addEventListener("click", async () => {
      const raw = document.getElementById("rootId").value.trim();
      const id = await resolveEntityInput(raw);
      if (!id) return;
      document.getElementById("rootId").value = id;
      loadEntityInfo(id);
      loadLocations(id);
    });

  // For person opening info we assume the provided id is a Person id; avoid name resolution
  document
    .getElementById("loadPersonOpening")
    ?.addEventListener("click", async () => {
      const raw = document.getElementById("rootId").value.trim();
      const id = raw;
      if (!id) return;
      document.getElementById("rootId").value = id;
      loadPersonOpening(id);
    });

  document
    .getElementById("loadPersonNetwork")
    ?.addEventListener("click", async () => {
      const raw = document.getElementById("rootId").value.trim();
      const id = raw; // expect a person id like P1
      if (!id) return;
      const graphEl = document.getElementById("personNetworkHomeGraph");
      const relationsEl = document.getElementById("personRelationsHomeCard");
      await loadPersonNetworkEmbed(id, { graphEl, relationsEl });
    });

  document.getElementById("loadNews")?.addEventListener("click", async () => {
    const raw = document.getElementById("rootId").value.trim();
    const id = await resolveEntityInput(raw);
    if (!id) return;
    document.getElementById("rootId").value = id;
    loadEntityInfo(id);
    loadNews(id);
  });

  document
    .getElementById("analyzeRisks")
    ?.addEventListener("click", async () => {
      const raw = document.getElementById("rootId").value.trim();
      const id = await resolveEntityInput(raw);
      if (!id) return;
      document.getElementById("rootId").value = id;
      loadEntityInfo(id);
      const newsLimit = parseInt(
        document.getElementById("riskNewsLimit").value || "5",
        10
      );
      analyzeRisks(id, newsLimit);
    });

  // Export Risk Analysis as PDF (delegated listener so dynamically-inserted button works)
  document.addEventListener("click", async (ev) => {
    // Be defensive: ev.target may be a Text node in some browsers; ensure it's an Element
    const targetEl =
      ev.target instanceof Element ? ev.target : ev.target.parentElement;
    // First try exact id match (preferred)
    let btn = targetEl ? targetEl.closest("#exportRiskPdf") : null;
    // Fallbacks: some render paths create a visually identical button without the id.
    // Try common attribute/title selectors or matching button text content.
    if (!btn && targetEl) {
      btn = targetEl.closest(
        'button[title="导出 PDF"], button[data-export="risk-pdf"]'
      );
    }
    if (!btn && targetEl) {
      // Walk up from the target to find a BUTTON whose trimmed textContent equals the expected label.
      let el = targetEl;
      while (el) {
        if (el.tagName === "BUTTON") {
          try {
            const txt = (el.textContent || "").trim();
            if (txt === "导出 PDF") {
              btn = el;
              break;
            }
          } catch (_e) {}
        }
        el = el.parentElement;
      }
    }
    if (!btn) return;
    // Use console.log (more visible than debug) so users see the message even when
    // DevTools filters hide verbose/DEBUG-level logs.
    try {
      console.log("exportRiskPdf clicked", btn);
    } catch (_) {}
    // avoid double-processing
    if (btn.dataset.exporting === "1") return;
    btn.dataset.exporting = "1";
    let original = btn.innerHTML;
    try {
      // Try to obtain the selected entity id from multiple places in the UI.
      const rootEl = document.getElementById("rootId");
      let raw = rootEl?.value?.trim() || "";
      // Fallback 1: dashboardSection may carry a data-loaded-id attribute
      if (!raw) {
        const dash = document.getElementById("dashboardSection");
        if (dash?.dataset?.loadedId) raw = dash.dataset.loadedId;
      }
      // Fallback 2: entity info panel often includes a <code> element with the ID
      if (!raw) {
        const codeEl = document.querySelector(
          "#entityInfo code, section[data-loaded-id] code, .font-mono"
        );
        const txt = codeEl ? (codeEl.textContent || "").trim() : "";
        if (txt && /^[PC]\w+/i.test(txt)) raw = txt;
      }
      // Fallback 3: scan all <code> elements for a likely entity id (P... or C...)
      if (!raw) {
        const codes = Array.from(document.querySelectorAll("code"));
        for (const c of codes) {
          const t = (c.textContent || "").trim();
          if (t && /^[PC]\w+/i.test(t)) {
            raw = t;
            break;
          }
        }
      }

      if (!raw) {
        // If no entity is selected, provide a quick mock-export so users can test the
        // download flow without blocking on backend resolution. This produces a
        // small HTML summary file saved with a .pdf extension (mock).
        try {
          console.log(
            "exportRiskPdf: no entity selected — producing mock export"
          );
          const now = new Date().toISOString().replace(/[:.]/g, "-");
          const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mock CDD</title></head><body><h1>Mock CDD Export</h1><p>No entity selected in the UI. This is a mock PDF file for testing the export flow.</p><p>Generated: ${now}</p></body></html>`;
          const blob = new Blob([html], { type: "text/html" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `cdd_mock_${now}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
          alert(
            "未检测到已选实体，已生成 mock 导出文件 (HTML, 以 .pdf 后缀保存) 以便测试。请在真实导出工作后恢复后端导出。"
          );
        } catch (e) {
          console.error("mock export failed", e);
          alert("未选择实体，且 mock 导出失败。请先加载实体或报告日志。");
        }
        return;
      }

      const id = await resolveEntityInput(raw);
      // if (!id) {
      //   alert("未能解析实体ID，请先加载实体或手动输入ID");
      //   return;
      // }
      document.getElementById("rootId").value = id;
      loadEntityInfo(id);
      const newsLimit = parseInt(
        document.getElementById("riskNewsLimit").value || "5",
        10
      );
      original = btn.innerHTML;
      btn.innerHTML = '<span class="animate-spin">↻</span> 生成中...';
      btn.disabled = true;
      const payload = { entity_id: id, news_limit: newsLimit, depth: 3 };
      const resp = await fetch("/reports/cdd-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`Export failed: ${resp.status}`);
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cdd_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error(e);
      alert("导出 PDF 失败");
    } finally {
      btn.dataset.exporting = "0";
      try {
        btn.innerHTML = original;
        btn.disabled = false;
      } catch (_) {}
    }
  });
}
