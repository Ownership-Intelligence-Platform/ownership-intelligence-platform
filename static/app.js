// Entry module: lean shell that bootstraps base UI and wires feature-specific handlers.

import { loadHomePartials } from "./modules/partials.js";
import { bootstrapApp } from "./modules/init.js";
import { wireCoreEvents } from "./modules/events.js";
import { wireKbUi } from "./modules/kbUi.js";
import { wireReportHandlers } from "./modules/report.js";
import { initHomeReveal } from "./modules/homeReveal.js";
import { initMcpPanel } from "./modules/mcp.js";

// Load page partials first to ensure DOM elements exist before wiring
await loadHomePartials();

// Initialize base UI and all event handlers
bootstrapApp();
wireCoreEvents();
wireKbUi();
wireReportHandlers();
initHomeReveal();
initMcpPanel();

// Optional: expose selected functions for manual debugging in the browser console
import { loadLayers } from "./modules/layers.js";
import { loadNews } from "./modules/news.js";
import { loadPenetration } from "./modules/penetration.js";
import { populateMock, clearDb } from "./modules/db.js";
import { loadAccounts } from "./modules/accounts.js";
import { loadTransactions } from "./modules/transactions.js";
import { loadGuarantees } from "./modules/guarantees.js";
import { loadSupplyChain } from "./modules/supplyChain.js";
import { loadEmployment } from "./modules/employment.js";
import { loadLocations } from "./modules/locations.js";
import { analyzeRisks } from "./modules/risks.js";
import { evaluateKbRisk, annotateGraph } from "./modules/kbRisk.js";

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
