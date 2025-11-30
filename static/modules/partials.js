// Load home page partial sections into #rightPanel to keep index.html slim
export async function loadHomePartials() {
  const right = document.getElementById("rightPanel");
  if (!right) return;
  const files = [
    "/static/partials/chatTranscriptSection.html",
    "/static/partials/controlsSection.html",
    "/static/partials/entityInfoSection.html",
    "/static/partials/externalSection.html",
    "/static/partials/dashboardSection.html",
  ];
  for (const url of files) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      const html = await res.text();
      const div = document.createElement("div");
      div.innerHTML = html;
      // Append children (avoid double wrapper).
      // If a top-level node has an id that already exists in the document, skip it
      // to make this operation idempotent when called multiple times (e.g. snapshots).
      while (div.firstChild) {
        const node = div.firstChild;
        if (node && node.id && document.getElementById(node.id)) {
          // already injected earlier, drop this node
          div.removeChild(node);
          continue;
        }
        right.appendChild(node);
      }
    } catch (e) {
      console.error("Failed to load partial:", url, e);
    }
  }

  // After the main sections are injected: defer loading specific dashboard cards
  // until a user performs a query so we can load only the relevant cards.
  // Equalize heights of the person-opening and entity info cards so they match (person opening as source)
  try {
    equalizeEntityPersonHeights();
  } catch (e) {
    // ignore in environments where DOM not fully ready
  }
}

// Ensure cards keep equal height (match to personOpeningBox height). Safe to call repeatedly.
function equalizeEntityPersonHeights() {
  const personBox = document.getElementById("personOpeningBox");
  const entityBox = document.getElementById("entityInfo");
  if (!personBox || !entityBox) return;
  const personCard = personBox.closest(".rounded-lg");
  const entityCard = entityBox.closest(".rounded-lg");
  if (!personCard || !entityCard) return;
  // Reset heights first
  personCard.style.minHeight = "";
  entityCard.style.minHeight = "";
  // Try to align to the bottom of the tip text inside the person box (if present)
  const tipEl = personBox.querySelector(".text-[11px], .text-xs, .text-[11px]");
  try {
    const personRect = personCard.getBoundingClientRect();
    if (tipEl) {
      const tipRect = tipEl.getBoundingClientRect();
      const target = Math.ceil(tipRect.bottom - personRect.top + 8); // small padding
      if (target > 0) {
        personCard.style.minHeight = target + "px";
        entityCard.style.minHeight = target + "px";
        return;
      }
    }
  } catch (e) {
    // fallback to full card height below
  }
  // Fallback: Use the computed full height of the person card as the source of truth
  const h = Math.ceil(personCard.getBoundingClientRect().height);
  if (h > 0) {
    personCard.style.minHeight = h + "px";
    entityCard.style.minHeight = h + "px";
  }
}

// Run equalization on window resize (debounced)
let __eqResizeTimer = null;
window.addEventListener("resize", () => {
  if (__eqResizeTimer) clearTimeout(__eqResizeTimer);
  __eqResizeTimer = setTimeout(() => {
    try {
      equalizeEntityPersonHeights();
    } catch (e) {
      /* noop */
    }
  }, 150);
});

export async function loadDashboardCards(id, rawInput) {
  // id: resolved internal id (e.g., P1 or E123)
  // rawInput: the original user input (useful to detect person ids like P...)
  const container = document.getElementById("dashboardSection");
  if (!container) return;

  // If no id/rawInput provided, don't eagerly load cards on page load.
  if (!id && !rawInput) return;

  // Determine if this looks like a person id
  let isPerson = false;
  try {
    if (rawInput && /^P\w+/i.test(rawInput)) isPerson = true;
    else if (id && /^P\w+/i.test(id)) isPerson = true;
  } catch (e) {
    // ignore regex errors
  }

  // If the container already contains cards for the same id, no-op
  try {
    if (
      container.dataset &&
      container.dataset.loadedId === String(id || rawInput)
    )
      return;
  } catch (e) {
    // ignore
  }

  // Clear any previously loaded cards so we can load a fresh set for the new id
  container.innerHTML = "";

  // Choose card partials according to requested view
  const personCardPartials = [
    // For person queries we keep only: person network, accounts, transactions, employment, news, risk analysis
    "/static/partials/cards/personNetworkCard.html",
    "/static/partials/cards/accountsCard.html",
    "/static/partials/cards/transactionsCard.html",
    "/static/partials/cards/employmentCard.html",
    "/static/partials/cards/newsCard.html",
    "/static/partials/cards/riskAnalysisCard.html",
  ];

  const entityCardPartials = [
    // For enterprise/company queries keep the requested set
    "/static/partials/cards/layersTreeCard.html",
    "/static/partials/cards/representativesCard.html",
    "/static/partials/cards/accountsCard.html",
    "/static/partials/cards/transactionsCard.html",
    "/static/partials/cards/guaranteesCard.html",
    "/static/partials/cards/supplyChainCard.html",
    "/static/partials/cards/locationsCard.html",
    "/static/partials/cards/newsCard.html",
    "/static/partials/cards/penetrationCard.html",
    "/static/partials/cards/riskAnalysisCard.html",
    "/static/partials/cards/kbRiskCard.html",
  ];

  const cardPartials = isPerson ? personCardPartials : entityCardPartials;

  for (const url of cardPartials) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      const html = await res.text();
      // Defensive: if the partial contains element IDs that already exist in
      // the document, skip appending this partial to avoid duplicate UI
      // when parts of the page are pre-rendered server-side or preserved
      // in snapshots. We look for id="..." patterns and check existence.
      try {
        const idMatches = html.match(/id="([^"]+)"/g) || [];
        let skip = false;
        for (const m of idMatches) {
          const id = m.replace(/^id="/, "").replace(/"$/, "");
          if (id && document.getElementById(id)) {
            console.log(
              `partials: skipping ${url} because #${id} already exists`
            );
            skip = true;
            break;
          }
        }
        if (skip) continue;
      } catch (e) {
        // If anything goes wrong in the check, fall back to normal behaviour
      }
      const div = document.createElement("div");
      div.innerHTML = html;
      while (div.firstChild) container.appendChild(div.firstChild);
    } catch (e) {
      console.error("Failed to load card partial:", url, e);
    }
  }

  // remember which id we loaded for so repeated queries don't re-load unnecessarily
  try {
    container.dataset.loadedId = String(id || rawInput);
  } catch (e) {
    // ignore if dataset not available
  }
}
