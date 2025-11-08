// Tree building & rendering for ownership layers

function nodeLabel(n) {
  const name = n.name || "(no name)";
  return `${name} [${n.id}]${n.type ? " · " + n.type : ""}`;
}

/** Build a hierarchical tree structure from backend layer paths payload. */
export function buildTreeFromPaths(payload) {
  if (!payload || !payload.root) return null;
  const nodesById = new Map();

  const ensureNode = (n) => {
    if (!nodesById.has(n.id))
      nodesById.set(n.id, {
        id: n.id,
        name: n.name,
        type: n.type,
        children: [],
      });
    const existing = nodesById.get(n.id);
    if (n.name) existing.name = n.name;
    if (n.type) existing.type = n.type;
    return existing;
  };

  const rootNode = ensureNode(payload.root);
  (payload.layers || []).forEach((path) => {
    const { nodes = [], rels = [] } = path || {};
    nodes.forEach(ensureNode);
    rels.forEach((rel) => {
      const parent = nodesById.get(rel.from);
      const child = nodesById.get(rel.to);
      if (!parent || !child) return;
      const has = parent.children.some((c) => c.id === child.id);
      if (!has) {
        const childRef = nodesById.get(child.id);
        const annotated = { ...childRef, _stakeFromParent: rel.stake };
        parent.children.push(annotated);
      }
    });
  });
  return nodesById.get(payload.root.id) || rootNode;
}

/** Render a tree into a container element. */
export function renderTree(container, tree, rootId) {
  container.innerHTML = "";
  if (!tree) {
    container.textContent = "No data";
    return;
  }

  function buildList(node, parentId) {
    const li = document.createElement("li");
    li.appendChild(document.createTextNode(nodeLabel(node)));
    if (parentId && node._stakeFromParent != null) {
      const stakeEl = document.createElement("span");
      stakeEl.style.marginLeft = "6px";
      stakeEl.style.color = "#555";
      stakeEl.textContent = `(stake: ${Number(node._stakeFromParent).toFixed(
        2
      )}%)`;
      li.appendChild(stakeEl);
    }
    if (node.children && node.children.length) {
      const ul = document.createElement("ul");
      node.children.forEach((child) =>
        ul.appendChild(buildList(child, node.id))
      );
      li.appendChild(ul);
    }
    return li;
  }

  const rootList = document.createElement("ul");
  rootList.appendChild(buildList(tree, null));
  container.appendChild(rootList);
}
