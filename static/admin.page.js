// Minimal entry for the standalone Data Console page
import { initThemeToggle } from "./modules/theme.js";
import { initAdmin } from "./modules/admin.js";

// Initialize only what's needed on this page
initThemeToggle();
initAdmin();
