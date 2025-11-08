// Representatives loading

/** Fetch and render representatives for a company. */
export async function loadRepresentatives(companyId) {
  const el = document.getElementById("repsList");
  el.textContent = "Loading representatives…";
  try {
    const res = await fetch(
      `/representatives/${encodeURIComponent(companyId)}`
    );
    if (!res.ok) {
      el.textContent = "No representatives found.";
      return;
    }
    const data = await res.json();
    const reps = (data && data.representatives) || [];
    if (!reps.length) {
      el.textContent = "No representatives found.";
      return;
    }
    const ul = document.createElement("ul");
    reps.forEach((r) => {
      const li = document.createElement("li");
      const label = `${r.name || "(no name)"} [${r.id}]${
        r.type ? " · " + r.type : ""
      }${r.role ? " — " + r.role : ""}`;
      li.textContent = label;
      ul.appendChild(li);
    });
    el.innerHTML = "";
    el.appendChild(ul);
  } catch (e) {
    el.textContent = `Error loading representatives: ${e}`;
  }
}
