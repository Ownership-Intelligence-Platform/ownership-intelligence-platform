// Graph builder for equity penetration module
// Transforms layers and penetration payloads into a D3-friendly graph

/**
 * Combine layers and penetration payloads into a D3-friendly graph.
 * @param {Object} layersPayload
 * @param {Object} penetrationPayload
 * @returns {{nodes: Array, links: Array}}
 */
export function buildGraphFromLayersAndPenetration(
  layersPayload,
  penetrationPayload
) {
  const nodesById = new Map();
  const penetrationById = new Map();
  const links = [];

  (penetrationPayload?.items || []).forEach((item) => {
    if (item?.id != null) penetrationById.set(item.id, item.penetration || 0);
  });

  const ensureNode = (n) => {
    if (!n || !n.id) return null;
    if (!nodesById.has(n.id)) {
      nodesById.set(n.id, {
        id: n.id,
        name: n.name,
        type: n.type,
        penetration: penetrationById.get(n.id) || 0,
      });
    } else {
      const ref = nodesById.get(n.id);
      if (n.name) ref.name = n.name;
      if (n.type) ref.type = n.type;
    }
    return nodesById.get(n.id);
  };

  let rootId = null;
  if (layersPayload?.root) {
    const r = ensureNode(layersPayload.root);
    rootId = layersPayload.root.id;
    if (r && (r.penetration == null || r.penetration === 0))
      r.penetration = 100;
  }

  (layersPayload?.layers || []).forEach((path) => {
    const nodes = path?.nodes || [];
    const rels = path?.rels || [];
    nodes.forEach(ensureNode);
    rels.forEach((rel) => {
      if (!rel) return;
      const s = nodesById.get(rel.from);
      const t = nodesById.get(rel.to);
      if (!s || !t) return;
      const key = `${rel.from}->${rel.to}`;
      if (!links.find((l) => l._k === key)) {
        const parentPen =
          rel.from === rootId ? 100 : penetrationById.get(rel.from) || 0;
        const lt = (parentPen * (Number(rel.stake) || 0)) / 100;
        links.push({
          source: rel.from,
          target: rel.to,
          stake: rel.stake,
          lookthrough: lt,
          _k: key,
        });
      }
    });
  });

  return { nodes: Array.from(nodesById.values()), links };
}
