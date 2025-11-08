// Theme utilities
// Provides a simple toggle that persists the theme in localStorage.

/**
 * Initialize the theme toggle button behavior and apply stored theme.
 */
export function initThemeToggle() {
  const root = document.documentElement;
  const key = "oi_theme";

  function applyTheme(val) {
    if (val === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }

  try {
    applyTheme(localStorage.getItem(key));
  } catch {}

  const btn = document.getElementById("themeToggle");
  if (btn)
    btn.addEventListener("click", () => {
      const next = root.classList.contains("dark") ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(key, next);
      } catch {}
    });
}
