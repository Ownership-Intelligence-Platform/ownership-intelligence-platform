// Simple chat widget logic for the AI Assistant panel
// Enhancements: detect quoted entity names in messages to resolve against
// internal data first; if found, load the Entity Info card and show a
// lightweight confirmation reply without invoking the LLM. Otherwise,
// maintain in-memory history and call backend /chat endpoint.

import { resolveEntityInput } from "./utils.js";
import { loadEntityInfo } from "./entities.js";

let history = [];

function hideDashboard() {
  ["controlsSection", "entityInfoSection", "dashboardSection"].forEach((id) =>
    document.getElementById(id)?.classList.add("hidden")
  );
  const mainEl = document.querySelector("main");
  mainEl?.classList.remove("split-active");
  document.getElementById("chatSection")?.classList.remove("motion-pop-left");
  document.getElementById("rightPanel")?.classList.remove("motion-slide-in");
}

function appendMessage(role, content) {
  const list = document.getElementById("chatMessages");
  if (!list) return;
  const item = document.createElement("div");
  item.className = `px-3 py-2 rounded mb-2 text-sm whitespace-pre-wrap ${
    role === "user"
      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 self-end"
      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
  }`;
  item.textContent = content;
  list.appendChild(item);
  // scroll to bottom
  list.parentElement.scrollTop = list.parentElement.scrollHeight;
}

export function initChat() {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const sys = document.getElementById("chatSystemPrompt");
  const useWeb = document.getElementById("chatUseWeb");
  const webProvider = document.getElementById("chatWebProvider");
  if (!form || !input) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // Show and store user message
    appendMessage("user", text);
    history.push({ role: "user", content: text });
    input.value = "";

    // Try to extract a quoted entity name for internal resolution, e.g.:
    // help me search "Acme Holdings Ltd"
    // We match any straight or curly quotes.
    const m = text.match(/["“”'‘’]([^"“”'‘’]+)["“”'‘’]/);
    const candidate = m ? m[1].trim() : null;

    if (candidate) {
      try {
        const entityId = await resolveEntityInput(candidate);
        if (entityId) {
          // Update the root input fields
          const root = document.getElementById("rootId");
          if (root) root.value = entityId;
          const initRoot = document.getElementById("initialRootId");
          if (initRoot) initRoot.value = entityId;

          // Reveal hidden dashboard sections (home shows only chat initially)
          ["controlsSection", "entityInfoSection", "dashboardSection"].forEach(
            (id) => document.getElementById(id)?.classList.remove("hidden")
          );

          // Activate split layout and add entrance animations
          const mainEl = document.querySelector("main");
          mainEl?.classList.add("split-active");
          document
            .getElementById("chatSection")
            ?.classList.add("motion-pop-left");
          document
            .getElementById("rightPanel")
            ?.classList.add("motion-slide-in");

          // Load entity details and trigger full layers load via existing button handler
          loadEntityInfo(entityId);
          document.getElementById("loadLayers")?.click();

          // Respond inline without invoking the LLM
          appendMessage(
            "assistant",
            `Found internal entity and loaded its details: [${entityId}].`
          );
          history.push({
            role: "assistant",
            content: `Found internal entity and loaded its details: [${entityId}].`,
          });
          return; // skip LLM/web flow when resolved internally
        }
        // If resolution failed (e.g., 404) hide dashboard and fall through to LLM/web
        hideDashboard();
      } catch (err) {
        // Non-fatal; hide dashboard and fall back to LLM/web chat
        hideDashboard();
      }
    }

    // Show a temporary placeholder for assistant (LLM or web fallback)
    appendMessage("assistant", "…");

    try {
      const body = {
        message: text,
        history,
        system_prompt: sys ? sys.value.trim() || undefined : undefined,
        use_web: !!(useWeb && useWeb.checked),
        web_provider: webProvider ? webProvider.value : undefined,
      };
      const resp = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      // Replace last assistant placeholder with real content
      const list = document.getElementById("chatMessages");
      const last = list?.lastElementChild;
      const reply = data.reply || "";
      if (last) last.textContent = reply;
      else appendMessage("assistant", reply);
      history.push({ role: "assistant", content: reply });

      // If sources provided, render them as a tiny citation list below
      if (Array.isArray(data.sources) && data.sources.length) {
        const container = document.createElement("div");
        container.className =
          "px-3 py-2 rounded mb-2 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100";
        const listEl = document.createElement("ul");
        for (const s of data.sources) {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = s.url;
          a.textContent = s.title || s.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          li.appendChild(a);
          listEl.appendChild(li);
        }
        const heading = document.createElement("div");
        heading.className = "font-medium mb-1";
        heading.textContent = "Sources:";
        container.appendChild(heading);
        container.appendChild(listEl);
        const msgs = document.getElementById("chatMessages");
        msgs?.appendChild(container);
      }
    } catch (err) {
      const list = document.getElementById("chatMessages");
      const last = list?.lastElementChild;
      const msg = `Error: ${err}`;
      if (last) last.textContent = msg;
      else appendMessage("assistant", msg);
    }
  });

  // Optional: clear button
  const clearBtn = document.getElementById("chatClear");
  clearBtn?.addEventListener("click", () => {
    history = [];
    const list = document.getElementById("chatMessages");
    if (list) list.innerHTML = "";
    // Also hide the dashboard sections and exit split view
    hideDashboard();
  });
}
