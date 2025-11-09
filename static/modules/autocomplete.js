// Autocomplete module for #rootId entity input
// Provides fuzzy suggestions via /entities/suggest?q=...
// Renders a dropdown below the input; keyboard navigation and click selection.

let state = {
  inputEl: null,
  menuEl: null,
  items: [],
  highlighted: -1,
  pendingController: null,
};
let debounceTimer = null;

function ensureMenu() {
  if (state.menuEl) return state.menuEl;
  const div = document.createElement("div");
  div.id = "entity-autocomplete";
  div.className =
    "absolute mt-1 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow text-sm max-h-72 overflow-auto";
  div.style.display = "none";
  state.inputEl.parentElement.style.position = "relative"; // anchor
  state.inputEl.parentElement.appendChild(div);
  state.menuEl = div;
  return div;
}

function renderMenu() {
  const menu = ensureMenu();
  if (!state.items.length) {
    menu.innerHTML =
      '<div class="px-3 py-2 text-gray-500 dark:text-gray-400">No matches</div>';
    if (state.inputEl.value.trim()) menu.style.display = "block";
    else menu.style.display = "none";
    return;
  }
  // Align menu width & position with input
  try {
    menu.style.top = `${state.inputEl.offsetHeight}px`;
    menu.style.left = `0px`;
    menu.style.width = `${state.inputEl.offsetWidth}px`;
  } catch {}
  menu.innerHTML = state.items
    .map((item, idx) => {
      const active = idx === state.highlighted;
      const cls =
        "px-3 py-2 cursor-pointer flex flex-col gap-0.5 " +
        (active
          ? "bg-indigo-600 text-white"
          : "hover:bg-indigo-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200");
      const name = item.name ? item.name : "(no name)";
      return `<div data-idx="${idx}" class="${cls}">
        <div class="font-medium flex justify-between"><span>${name}</span><span class="text-xs opacity-75">${
        item.id
      }</span></div>
        <div class="text-xs opacity-75">${item.type || ""}</div>
      </div>`;
    })
    .join("");
  menu.style.display = "block";
}

function setHighlighted(idx) {
  state.highlighted = idx;
  renderMenu();
}

function pick(idx) {
  const item = state.items[idx];
  if (!item) return;
  state.inputEl.value = item.id; // Set to ID for backend calls
  hideMenu();
}

function hideMenu() {
  if (state.menuEl) state.menuEl.style.display = "none";
  state.items = [];
  state.highlighted = -1;
}

async function fetchSuggestions(q) {
  if (state.pendingController) state.pendingController.abort();
  const controller = new AbortController();
  state.pendingController = controller;
  try {
    const res = await fetch(
      `/entities/suggest?q=${encodeURIComponent(q)}&limit=10`,
      {
        signal: controller.signal,
      }
    );
    if (!res.ok) throw new Error("Search failed");
    const data = await res.json();
    state.items = data.items || [];
    state.highlighted = -1;
    renderMenu();
  } catch (err) {
    if (err.name === "AbortError") return; // ignore
    state.items = [];
    state.highlighted = -1;
    renderMenu();
  }
}

function onInput(e) {
  const q = e.target.value.trim();
  if (!q) {
    hideMenu();
    return;
  }
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchSuggestions(q), 150);
}

function onKeyDown(e) {
  if (state.menuEl?.style.display !== "block") return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    const next = state.highlighted + 1;
    setHighlighted(next >= state.items.length ? 0 : next);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const prev = state.highlighted - 1;
    setHighlighted(prev < 0 ? state.items.length - 1 : prev);
  } else if (e.key === "Enter") {
    if (state.highlighted >= 0) {
      e.preventDefault();
      pick(state.highlighted);
    }
  } else if (e.key === "Escape") {
    hideMenu();
  }
}

function onBlur(e) {
  // Delay hiding to allow click selection
  setTimeout(() => hideMenu(), 150);
}

function onClickMenu(e) {
  const target = e.target.closest("[data-idx]");
  if (!target) return;
  const idx = parseInt(target.getAttribute("data-idx"), 10);
  pick(idx);
}

export function initEntityAutocomplete() {
  const input = document.getElementById("rootId");
  if (!input) return;
  state.inputEl = input;
  ensureMenu();
  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("blur", onBlur);
  state.menuEl.addEventListener("mousedown", onClickMenu); // mousedown to precede blur
}
