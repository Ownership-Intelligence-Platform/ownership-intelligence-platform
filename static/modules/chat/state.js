// chat/state.js
// Centralized state management for chat history and pending external lookup info.
export const chatState = {
  history: [], // [{ role: 'user'|'assistant', content: string }]
  pendingExternal: null, // { name: string, askedAt: number } | null
};

export function pushHistory(role, content) {
  chatState.history.push({ role, content });
}

export function clearHistory() {
  chatState.history.length = 0;
}

export function setPendingExternal(obj) {
  chatState.pendingExternal = obj;
}

export function consumePendingExternal() {
  const p = chatState.pendingExternal;
  chatState.pendingExternal = null;
  return p;
}
