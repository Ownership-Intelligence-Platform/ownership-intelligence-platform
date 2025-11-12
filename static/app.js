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
import { evaluateKbRisk, annotateGraph } from "./modules/kbRisk.js";

// Initialize theme toggle
initThemeToggle();
// Initialize entity autocomplete
initEntityAutocomplete();
// Initialize data console only if its elements exist (home page now links out)
if (document.getElementById("btnCreatePerson")) {
  initAdmin();
}

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
