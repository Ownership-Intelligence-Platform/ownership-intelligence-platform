// Knowledge Base (KB) risk UI wiring and helpers.
// Handles chain toggle visibility, evaluation submission, graph annotation, and example chain loader.

import { resolveEntityInput } from "./utils.js";
import { loadEntityInfo } from "./entities.js";
import { evaluateKbRisk, annotateGraph, openGraphView } from "./kbRisk.js";

export function wireKbUi() {
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
  document
    .getElementById("kbLoadExampleChain")
    ?.addEventListener("click", () => {
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
}
