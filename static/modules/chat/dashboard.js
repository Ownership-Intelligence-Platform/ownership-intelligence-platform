// dashboard.js
// Snapshot + dashboard loading helpers separated from chat orchestrator.
// Responsibilities: hide canonical panels, clone sections, load data, create snapshot.

import { loadEntityInfo } from "../entities.js";
import { loadLayers } from "../layers.js";
import { loadAccounts } from "../accounts.js";
import { loadTransactions } from "../transactions.js";
import { loadGuarantees } from "../guarantees.js";
import { loadSupplyChain } from "../supplyChain.js";
import { loadEmployment } from "../employment.js";
import { loadLocations } from "../locations.js";
import { loadNews } from "../news.js";
import { analyzeRisks } from "../risks.js";
import { loadPenetration } from "../penetration.js";
import { loadPersonOpening } from "../personOpening.js";
import { loadPersonNetwork as loadPersonNetworkEmbed } from "../personNetworkEmbed.js";

function ensureStreamContainer() {
  let stream = document.getElementById("chatTurnStream");
  if (!stream) {
    const right = document.getElementById("rightPanel") || document.body;
    stream = document.createElement("section");
    stream.id = "chatTurnStream";
    stream.className = "flex flex-col gap-4";
    right.appendChild(stream);
  }
  return stream;
}

export function hideCanonicalPanels() {
  [
    "chatTranscriptSection",
    "controlsSection",
    "entityInfoSection",
    "dashboardSection",
  ].forEach((id) => document.getElementById(id)?.classList.add("hidden"));
}

function stripIdsDeep(root) {
  if (!root) return;
  if (root.nodeType === 1 && root.hasAttribute("id"))
    root.removeAttribute("id");
  root.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
}

function clonedSection(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const clone = el.cloneNode(true);
  clone.classList.remove("hidden");
  stripIdsDeep(clone);
  return clone;
}

export function createDashboardSnapshotCard(titleText, entityId) {
  const stream = ensureStreamContainer();
  const wrapper = document.createElement("section");
  wrapper.className =
    "rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm chat-dashboard-snapshot";
  const head = document.createElement("div");
  head.className =
    "px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between";
  const h = document.createElement("h3");
  h.className = "text-base font-semibold";
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const subtitle = entityId ? ` · ${entityId}` : "";
  h.textContent = `${titleText || "Dashboard"}${subtitle} · ${hh}:${mm}`;
  head.appendChild(h);
  wrapper.appendChild(head);
  const body = document.createElement("div");
  body.className = "p-3";
  const controlsClone = clonedSection("controlsSection");
  const infoClone = clonedSection("entityInfoSection");
  const grid = document.getElementById("dashboardSection");
  const gridClone = grid ? grid.cloneNode(true) : document.createElement("div");
  gridClone.classList.remove("hidden");
  stripIdsDeep(gridClone);
  if (controlsClone) body.appendChild(controlsClone);
  if (infoClone) body.appendChild(infoClone);
  body.appendChild(gridClone);
  wrapper.appendChild(body);
  stream.appendChild(wrapper);
  return wrapper;
}

export async function loadFullDashboardAndSnapshot(
  rootId,
  rawInput,
  snapshotTitle = "Dashboard"
) {
  const rootInput = document.getElementById("rootId");
  if (rootInput) rootInput.value = rootId;
  hideCanonicalPanels();
  try {
    const txDir =
      document.getElementById("txDirection")?.value?.trim() || "out";
    const gDir =
      document.getElementById("guaranteeDirection")?.value?.trim() || "out";
    const sDir =
      document.getElementById("supplyDirection")?.value?.trim() || "out";
    const role =
      document.getElementById("employmentRole")?.value?.trim() || "both";
    const newsLimit = parseInt(
      document.getElementById("riskNewsLimit")?.value || "5",
      10
    );

    await loadEntityInfo(rootId);
    await loadLayers();

    await Promise.allSettled([
      loadAccounts(rootId),
      loadTransactions(rootId, txDir),
      loadGuarantees(rootId, gDir),
      loadSupplyChain(rootId, sDir),
      loadEmployment(rootId, role),
      loadLocations(rootId),
      loadNews(rootId),
      analyzeRisks(rootId, newsLimit),
    ]);

    await Promise.allSettled([
      loadPenetration(),
      rawInput ? loadPersonOpening(rawInput) : Promise.resolve(),
      /^P\w+/i.test(rawInput || "")
        ? (async () => {
            const graphEl = document.getElementById("personNetworkHomeGraph");
            const relationsEl = document.getElementById(
              "personRelationsHomeCard"
            );
            if (graphEl || relationsEl)
              await loadPersonNetworkEmbed(rawInput, { graphEl, relationsEl });
          })()
        : Promise.resolve(),
    ]);
  } catch (_) {
    // Swallow partial failures; snapshot whatever is available.
  }
  return createDashboardSnapshotCard(snapshotTitle, rootId);
}

export function revealDashboard() {
  // Intentionally no-op: canonical panels kept hidden; snapshots are appended.
}
