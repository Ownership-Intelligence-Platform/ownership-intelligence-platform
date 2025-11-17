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
      // Append children (avoid double wrapper)
      while (div.firstChild) right.appendChild(div.firstChild);
    } catch (e) {
      console.error("Failed to load partial:", url, e);
    }
  }

  // After the main sections are injected, load dashboard cards into the grid container
  await loadDashboardCards();
}

async function loadDashboardCards() {
  const container = document.getElementById("dashboardSection");
  if (!container) return;
  const cardPartials = [
    "/static/partials/cards/personOpeningCard.html",
    "/static/partials/cards/personNetworkCard.html",
    "/static/partials/cards/layersTreeCard.html",
    "/static/partials/cards/representativesCard.html",
    "/static/partials/cards/accountsCard.html",
    "/static/partials/cards/transactionsCard.html",
    "/static/partials/cards/guaranteesCard.html",
    "/static/partials/cards/supplyChainCard.html",
    "/static/partials/cards/employmentCard.html",
    "/static/partials/cards/locationsCard.html",
    "/static/partials/cards/newsCard.html",
    "/static/partials/cards/penetrationCard.html",
    "/static/partials/cards/riskAnalysisCard.html",
    "/static/partials/cards/kbRiskCard.html",
  ];
  for (const url of cardPartials) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      const html = await res.text();
      const div = document.createElement("div");
      div.innerHTML = html;
      while (div.firstChild) container.appendChild(div.firstChild);
    } catch (e) {
      console.error("Failed to load card partial:", url, e);
    }
  }
}
