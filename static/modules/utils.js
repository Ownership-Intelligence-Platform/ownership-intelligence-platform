// Utilities shared across modules

/**
 * Resolve a user input (id or exact name) to a concrete entity id.
 * - Calls /entities/resolve?q=...
 * - If ambiguous, shows an alert listing options and returns null.
 * - Throws on network/HTTP errors other than 409/404 which are handled.
 */
export async function resolveEntityInput(input) {
  const q = String(input || "").trim();
  if (!q) return null;
  const res = await fetch(`/entities/resolve?q=${encodeURIComponent(q)}`);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 404) {
    alert(`No entity found for: ${q}`);
    return null;
  }
  if (!res.ok && res.status !== 200) {
    // Some servers might return 200 even on ambiguity; handle generically
    const msg = (data && data.detail) || res.statusText;
    throw new Error(`Failed to resolve entity: ${msg}`);
  }
  // Ambiguous: provide choices to the user
  if (data && data.ambiguous) {
    const matches = data.matches || [];
    if (!matches.length) {
      alert(`Multiple entities match name "${q}", but none could be listed.`);
      return null;
    }
    const list = matches
      .map(
        (m, i) =>
          `${i + 1}. ${m.name || "(no name)"} [${m.id}]${
            m.type ? ` · ${m.type}` : ""
          }`
      )
      .join("\n");
    const picked = prompt(
      `Multiple entities match the name "${q}".\n\n${list}\n\nEnter the number of the entity to use, or press Cancel:`,
      "1"
    );
    if (!picked) return null;
    const idx = Number(picked) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= matches.length) {
      alert("Invalid selection.");
      return null;
    }
    return matches[idx].id;
  }
  if (data && data.ok && data.entity && data.entity.id) {
    return data.entity.id;
  }
  // Fallback: if the server returned plain entity
  if (data && data.id) return data.id;
  return null;
}
