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
  loadLayers();
});
document
  .getElementById("loadPenetration")
  ?.addEventListener("click", async () => {
    const raw = document.getElementById("rootId").value.trim();
    const id = await resolveEntityInput(raw);
    if (!id) return;
    document.getElementById("rootId").value = id;
    loadPenetration();
  });
document.getElementById("loadAccounts")?.addEventListener("click", async () => {
  const raw = document.getElementById("rootId").value.trim();
  const id = await resolveEntityInput(raw);
  if (!id) return;
  document.getElementById("rootId").value = id;
  loadAccounts(id);
});
document
  .getElementById("loadTransactions")
  ?.addEventListener("click", async () => {
    const raw = document.getElementById("rootId").value.trim();
    const id = await resolveEntityInput(raw);
    if (!id) return;
    document.getElementById("rootId").value = id;
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
    loadLocations(id);
  });
document.getElementById("loadNews")?.addEventListener("click", async () => {
  const raw = document.getElementById("rootId").value.trim();
  const id = await resolveEntityInput(raw);
  if (!id) return;
  document.getElementById("rootId").value = id;
  loadNews(id);
});
document.getElementById("analyzeRisks")?.addEventListener("click", async () => {
  const raw = document.getElementById("rootId").value.trim();
  const id = await resolveEntityInput(raw);
  if (!id) return;
  document.getElementById("rootId").value = id;
  const newsLimit = parseInt(
    document.getElementById("riskNewsLimit").value || "5",
    10
  );
  analyzeRisks(id, newsLimit);
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
};
