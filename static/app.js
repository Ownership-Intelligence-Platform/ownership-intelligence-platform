// Entry module: imports refactored functionality and wires UI events.
import { initThemeToggle } from "./modules/theme.js";
import { loadLayers } from "./modules/layers.js";
import { loadNews } from "./modules/news.js";
import { loadPenetration } from "./modules/penetration.js";
import { populateMock, clearDb } from "./modules/db.js";

// Initialize theme toggle
initThemeToggle();

// Event wiring (DOM exists because script is loaded at end of body)
document
  .getElementById("populate")
  ?.addEventListener("click", () => populateMock(loadLayers));
document.getElementById("clearDb")?.addEventListener("click", clearDb);
document.getElementById("loadLayers")?.addEventListener("click", loadLayers);
document
  .getElementById("loadPenetration")
  ?.addEventListener("click", loadPenetration);
document.getElementById("loadNews")?.addEventListener("click", () => {
  const id = document.getElementById("rootId").value.trim();
  if (!id) {
    alert("Please enter an entity id");
    return;
  }
  loadNews(id);
});

// Debug / manual access in browser console
window.OI = { loadLayers, loadNews, loadPenetration, populateMock, clearDb };
