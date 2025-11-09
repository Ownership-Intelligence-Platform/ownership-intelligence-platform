// Entry module: imports refactored functionality and wires UI events.
import { initThemeToggle } from "./modules/theme.js";
import { loadLayers } from "./modules/layers.js";
import { loadNews } from "./modules/news.js";
import { loadPenetration } from "./modules/penetration.js";
import { populateMock, clearDb } from "./modules/db.js";
import { initAdmin } from "./modules/admin.js";
import { loadAccounts } from "./modules/accounts.js";
import { loadTransactions } from "./modules/transactions.js";

// Initialize theme toggle
initThemeToggle();
// Initialize data console only if its elements exist (home page now links out)
if (document.getElementById("btnCreatePerson")) {
  initAdmin();
}

// Event wiring (DOM exists because script is loaded at end of body)
document
  .getElementById("populate")
  ?.addEventListener("click", () => populateMock(loadLayers));
document.getElementById("clearDb")?.addEventListener("click", clearDb);
document.getElementById("loadLayers")?.addEventListener("click", loadLayers);
document
  .getElementById("loadPenetration")
  ?.addEventListener("click", loadPenetration);
document.getElementById("loadAccounts")?.addEventListener("click", () => {
  const id = document.getElementById("rootId").value.trim();
  if (!id) return alert("Enter Root Entity ID first");
  loadAccounts(id);
});
document.getElementById("loadTransactions")?.addEventListener("click", () => {
  const id = document.getElementById("rootId").value.trim();
  if (!id) return alert("Enter Root Entity ID first");
  const direction = document.getElementById("txDirection").value.trim();
  loadTransactions(id, direction);
});
document.getElementById("loadNews")?.addEventListener("click", () => {
  const id = document.getElementById("rootId").value.trim();
  if (!id) {
    alert("Please enter an entity id");
    return;
  }
  loadNews(id);
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
};
