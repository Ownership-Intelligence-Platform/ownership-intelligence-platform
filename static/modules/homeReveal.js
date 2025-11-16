// Lightweight bootstrap to keep only chat visible until an entity is searched
export function initHomeReveal() {
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("initialEntityForm");
    const input = document.getElementById("initialRootId");
    const rootInput = document.getElementById("rootId");
    const controls = document.getElementById("controlsSection");
    const info = document.getElementById("entityInfoSection");
    const dash = document.getElementById("dashboardSection");
    const rightPanel = document.getElementById("rightPanel");
    const chatSection = document.getElementById("chatSection");
    const loadBtn = document.getElementById("loadLayers");

    function reveal() {
      controls?.classList.remove("hidden");
      info?.classList.remove("hidden");
      dash?.classList.remove("hidden");
      chatSection?.classList.add("motion-pop-left");
      rightPanel?.classList.add("motion-slide-in");
    }

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input?.value?.trim();
      if (!val) return;
      if (rootInput) rootInput.value = val;
      reveal();
      loadBtn?.click();
    });
  });
}
