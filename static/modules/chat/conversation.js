// conversation.js
// Conversation card + message rendering utilities.

export function ensureStreamContainer() {
  let stream = document.getElementById("chatTurnStream");
  if (!stream) {
    const right = document.getElementById("rightPanel") || document.body;
    stream = document.createElement("section");
    stream.id = "chatTurnStream";
    stream.className = "flex flex-col gap-4";
    right.appendChild(stream);
  }
  return stream;
}

export function createConversationCard(titleText) {
  const stream = ensureStreamContainer();
  const wrapper = document.createElement("section");
  wrapper.className =
    "rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm chat-conversation-card";
  const header = document.createElement("div");
  header.className =
    "px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between";
  const h = document.createElement("h3");
  h.className = "text-base font-semibold";
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  h.textContent = `${titleText || "对话"} · ${hh}:${mm}`;
  header.appendChild(h);
  wrapper.appendChild(header);
  const body = document.createElement("div");
  body.className = "max-h-[28vh] overflow-y-auto p-3 space-y-2";
  wrapper.appendChild(body);
  stream.appendChild(wrapper);
  return { cardEl: wrapper, messagesEl: body };
}

export function appendMessage(role, content, targetListEl) {
  const list = targetListEl || document.getElementById("chatMessages");
  if (!list) return;
  if (list.id === "chatMessages") {
    document
      .getElementById("chatTranscriptSection")
      ?.classList.remove("hidden");
    if (list.classList.contains("hidden")) list.classList.remove("hidden");
  }
  const item = document.createElement("div");
  item.className = `px-3 py-2 rounded mb-2 text-sm whitespace-pre-wrap ${
    role === "user"
      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 self-end"
      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
  }`;
  item.textContent = content;
  list.appendChild(item);
  if (list.parentElement)
    list.parentElement.scrollTop = list.parentElement.scrollHeight;
}

export function createDashboardHintCard(matches) {
  if (!matches?.length) return null;
  const stream = ensureStreamContainer();
  const card = document.createElement("section");
  card.className =
    "rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 shadow-sm";
  const head = document.createElement("div");
  head.className =
    "px-4 py-3 border-b border-indigo-200 dark:border-indigo-800 flex items-center justify-between";
  const h = document.createElement("h3");
  h.className = "text-base font-semibold text-indigo-900 dark:text-indigo-100";
  h.textContent = "Dashboard 建议";
  head.appendChild(h);
  card.appendChild(head);
  const body = document.createElement("div");
  body.className = "p-3 text-sm text-indigo-900/80 dark:text-indigo-100/90";
  const p = document.createElement("div");
  p.className = "mb-2";
  p.textContent = "已匹配主题：";
  body.appendChild(p);
  const wrap = document.createElement("div");
  wrap.className = "flex flex-wrap gap-2";
  matches.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "inline-flex items-center rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500";
    btn.textContent = m.label;
    btn.addEventListener("click", () => {
      document.getElementById(m.id)?.dispatchEvent(new Event("click"));
    });
    wrap.appendChild(btn);
  });
  body.appendChild(wrap);
  card.appendChild(body);
  stream.appendChild(card);
  return card;
}
