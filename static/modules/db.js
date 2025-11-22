// DB actions (populate & clear)

/** Populate mock data via backend endpoint, then refresh layers UI. */
export async function populateMock(onAfterPopulate) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = "Populating...";
  const res = await fetch("/populate-mock", { method: "POST" });
  const txt = await res.json().catch(() => ({ message: res.statusText }));
  statusEl.textContent = JSON.stringify(txt);
  try {
    if (typeof onAfterPopulate === "function") await onAfterPopulate();
  } catch {}
  setTimeout(() => (statusEl.textContent = ""), 3000);
}

/** Import extended persons CSV via backend endpoint. */
export async function importPersons(onAfterImport) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = "Importing persons...";
  try {
    const res = await fetch("/persons/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({ message: res.statusText }));
    statusEl.textContent =
      typeof data === "object" ? JSON.stringify(data) : String(data);
    if (typeof onAfterImport === "function") await onAfterImport();
  } catch (e) {
    statusEl.textContent = `Failed persons import: ${e}`;
  } finally {
    setTimeout(() => (statusEl.textContent = ""), 4000);
  }
}

/** Clear graph database via backend endpoint and reset UI. */
export async function clearDb() {
  if (
    !confirm("This will delete ALL nodes and relationships in Neo4j. Continue?")
  )
    return;
  const statusEl = document.getElementById("status");
  statusEl.textContent = "Clearing database…";
  try {
    const res = await fetch("/clear-db", { method: "POST" });
    const data = await res.json().catch(() => ({ message: res.statusText }));
    statusEl.textContent =
      typeof data === "object" ? JSON.stringify(data) : String(data);
    document.getElementById("layersTree").textContent =
      "Database cleared. Re-populate to view layers.";
    document.getElementById("penetrationChart").textContent = "";
  } catch (e) {
    statusEl.textContent = `Failed to clear: ${e}`;
  } finally {
    setTimeout(() => (statusEl.textContent = ""), 3000);
  }
}
