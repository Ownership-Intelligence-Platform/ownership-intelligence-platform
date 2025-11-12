// Entry module: imports refactored functionality and wires UI events.
import { initThemeToggle } from "./modules/theme.js";
import { loadLayers } from "./modules/layers.js";
import { loadNews } from "./modules/news.js";
import { loadPenetration } from "./modules/penetration.js";
import { populateMock, clearDb } from "./modules/db.js";
import { initAdmin } from "./modules/admin.js";
import { loadAccounts } from "./modules/accounts.js";
import { loadTransactions } from "./modules/transactions.js";
import { loadGuarantees } from "./modules/guarantees.js";
import { loadSupplyChain } from "./modules/supplyChain.js";
import { loadEmployment } from "./modules/employment.js";
import { loadLocations } from "./modules/locations.js";
import { analyzeRisks } from "./modules/risks.js";
import { resolveEntityInput } from "./modules/utils.js";
import { initEntityAutocomplete } from "./modules/autocomplete.js";
import { loadEntityInfo } from "./modules/entities.js";
import { initChat } from "./modules/chat.js";
import {
  evaluateKbRisk,
  annotateGraph,
  openGraphView,
} from "./modules/kbRisk.js";

// Initialize theme toggle
initThemeToggle();
// Initialize entity autocomplete
initEntityAutocomplete();
// Initialize data console only if its elements exist (home page now links out)
if (document.getElementById("btnCreatePerson")) {
  initAdmin();
}

// Initialize chat widget if present
initChat();

// Event wiring (DOM exists because script is loaded at end of body)
document
  .getElementById("populate")
  ?.addEventListener("click", () => populateMock(loadLayers));
document.getElementById("clearDb")?.addEventListener("click", clearDb);
document.getElementById("loadLayers")?.addEventListener("click", async () => {
  const raw = document.getElementById("rootId").value.trim();
  const id = await resolveEntityInput(raw);
  if (!id) return;
  document.getElementById("rootId").value = id;
  // Load entity info panel first so users see description quickly
  loadEntityInfo(id);
  loadLayers();
});
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
document.getElementById("loadAccounts")?.addEventListener("click", async () => {
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
document.getElementById("loadNews")?.addEventListener("click", async () => {
  const raw = document.getElementById("rootId").value.trim();
  const id = await resolveEntityInput(raw);
  if (!id) return;
  document.getElementById("rootId").value = id;
  loadEntityInfo(id);
  loadNews(id);
});
document.getElementById("analyzeRisks")?.addEventListener("click", async () => {
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

// KB Risk UI handlers
const kbUseCustomChainEl = document.getElementById("kbUseCustomChain");
const kbChainBoxEl = document.getElementById("kbChainBox");
kbUseCustomChainEl?.addEventListener("change", () => {
  if (!kbChainBoxEl) return;
  kbChainBoxEl.classList.toggle("hidden", !kbUseCustomChainEl.checked);
});

document
  .getElementById("evaluateKbRisk")
  ?.addEventListener("click", async () => {
    const raw = document.getElementById("rootId").value.trim();
    const id = await resolveEntityInput(raw);
    if (!id) return;
    document.getElementById("rootId").value = id;
    loadEntityInfo(id);
    let body = null;
    const errEl = document.getElementById("kbChainError");
    if (kbUseCustomChainEl?.checked) {
      const txt = document.getElementById("kbChainJson").value.trim();
      if (txt) {
        try {
          body = JSON.parse(txt);
          if (errEl) {
            errEl.textContent = "";
            errEl.classList.add("hidden");
          }
        } catch (e) {
          if (errEl) {
            errEl.textContent = "Invalid JSON: " + e;
            errEl.classList.remove("hidden");
          }
          return;
        }
      }
    } else {
      body = { entity_id: id };
    }
    evaluateKbRisk(id, body);
  });

document
  .getElementById("annotateGraph")
  ?.addEventListener("click", async () => {
    const raw = document.getElementById("rootId").value.trim();
    const id = await resolveEntityInput(raw);
    if (!id) return;
    document.getElementById("rootId").value = id;
    loadEntityInfo(id);
    annotateGraph(id);
  });

// Open Graph button: focus penetration graph for current entity (fallback to person network page)
document.getElementById("openGraph")?.addEventListener("click", async () => {
  const raw = document.getElementById("rootId").value.trim();
  const id = await resolveEntityInput(raw);
  if (!id) return;
  document.getElementById("rootId").value = id;
  loadEntityInfo(id);
  openGraphView(id);
});

// Load Example Chain: populate the textarea with a curated demo and show it
document.getElementById("kbLoadExampleChain")?.addEventListener("click", () => {
  const toggle = document.getElementById("kbUseCustomChain");
  const box = document.getElementById("kbChainBox");
  const ta = document.getElementById("kbChainJson");
  const err = document.getElementById("kbChainError");
  if (toggle && box && ta) {
    toggle.checked = true;
    box.classList.remove("hidden");
    const example = {
      transfers: [
        {
          from: "A1",
          to: "B1",
          amount_cny: 20000,
          date: "2025-01-01",
          to_region: "CN",
        },
        {
          from: "A2",
          to: "B1",
          amount_cny: 18000,
          date: "2025-01-02",
          to_region: "CN",
        },
        {
          from: "A3",
          to: "B1",
          amount_cny: 22000,
          date: "2025-01-03",
          to_region: "HK",
        },
        {
          from: "A4",
          to: "B1",
          amount_cny: 24000,
          date: "2025-01-04",
          to_region: "HK",
        },
        {
          from: "A5",
          to: "B1",
          amount_cny: 19000,
          date: "2025-01-05",
          to_region: "KY",
        },
      ],
      beneficiary_name: "ACME OFFSHORE LTD",
    };
    ta.value = JSON.stringify(example, null, 2);
    if (err) {
      err.textContent = "";
      err.classList.add("hidden");
    }
    ta.focus();
  }
});

// Debug / manual access in browser console
window.OI = {
  loadLayers,
  loadNews,
  loadPenetration,
  populateMock,
  clearDb,
  loadAccounts,
  loadTransactions,
  loadGuarantees,
  loadSupplyChain,
  loadEmployment,
  loadLocations,
  analyzeRisks,
  evaluateKbRisk,
  annotateGraph,
};

// Report generation handler (HTML output)
document
  .getElementById("generateReportHtml")
  ?.addEventListener("click", async () => {
    const raw = document.getElementById("rootId").value.trim();
    const id = await resolveEntityInput(raw);
    if (!id) return;
    document.getElementById("rootId").value = id;
    loadEntityInfo(id);
    const depth = parseInt(document.getElementById("depth").value || "2", 10);
    const newsLimit = parseInt(
      document.getElementById("reportNewsLimit").value || "5",
      10
    );
    const bilingual = document.getElementById("reportBilingual").checked;

    const statusEl = document.getElementById("status");
    if (statusEl) statusEl.textContent = "Generating report...";
    try {
      const url = `/reports/cdd/${encodeURIComponent(
        id
      )}?format=html&depth=${depth}&news_limit=${newsLimit}&bilingual=${bilingual}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      // Open HTML report in a new tab (served from disk path may not be accessible via /static so inline preview)
      if (data.content_html) {
        const w = window.open("about:blank", "_blank");
        if (w) {
          w.document.write(data.content_html);
          w.document.close();
        }

        // Also trigger a client-side download of the HTML using a Blob
        try {
          const blob = new Blob([data.content_html], {
            type: "text/html;charset=utf-8",
          });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `CDD_${id}.html`;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            URL.revokeObjectURL(link.href);
            link.remove();
          }, 500);
        } catch (_) {
          // noop if download fails; the new tab still shows the content
        }
      }
      if (statusEl) statusEl.textContent = "Report generated.";
    } catch (e) {
      if (statusEl) statusEl.textContent = `Failed to generate report: ${e}`;
    }
  });
