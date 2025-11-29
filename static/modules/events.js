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
}
