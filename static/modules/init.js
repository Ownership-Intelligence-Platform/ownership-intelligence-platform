// Centralized base initialization for the frontend shell.
// - Theme toggle
// - Entity autocomplete
// - Admin UI (only if admin controls exist)
// - Chat widget (no-op if elements are absent)

import { initThemeToggle } from "./theme.js";
import { initEntityAutocomplete } from "./autocomplete.js";
import { initAdmin } from "./admin.js";
import { initChat } from "./chat.js";

export function bootstrapApp() {
  // Theme + global UI affordances
  initThemeToggle();
  initEntityAutocomplete();

  // Initialize data console/admin UI if present on the page
  if (document.getElementById("btnCreatePerson")) {
    initAdmin();
  }

  // Initialize chat widget if present
  initChat();
}
