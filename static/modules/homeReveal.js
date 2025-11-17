// Lightweight bootstrap to keep only chat visible until an entity is searched
export function initHomeReveal() {
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("initialEntityForm");
    const input = document.getElementById("initialRootId");
    const rootInput = document.getElementById("rootId");
    const loadBtn = document.getElementById("loadLayers");

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input?.value?.trim();
      if (!val) return;
      if (rootInput) rootInput.value = val;
      loadBtn?.click();
    });
  });
}
