from typing import Dict, Any, List
from app.db.neo4j_connector import run_cypher


def get_person_network(person_id: str) -> Dict[str, Any]:
    """Build a lightweight person-centric relationship graph.

    Nodes include:
    - The focal person (person_id)
    - Companies connected to the focal person via LEGAL_REP or SERVES_AS
    - Other persons connected to those companies via LEGAL_REP or SERVES_AS

    Links include:
    - Person -> Company edges for LEGAL_REP and SERVES_AS (with role)
    - Person <-> Person edges labeled SHARE_COMPANY for persons connected to the same company

    Returns a dict: { person, nodes, links }
    """
    # Ensure the focal person exists
    person_res = run_cypher(
        "MATCH (p:Entity {id: $id}) RETURN p.id AS id, p.name AS name, p.type AS type",
        {"id": person_id},
    )
    if not person_res:
        return {}

    # Companies and direct links from focal person
    comp_rows = run_cypher(
        (
            "MATCH (p0:Entity {id: $id}) "
            "OPTIONAL MATCH (p0)-[r:LEGAL_REP|SERVES_AS]->(c:Entity) "
            "RETURN collect(DISTINCT {id: c.id, name: c.name, type: c.type}) AS companies, "
            "       collect(DISTINCT {from: p0.id, to: c.id, type: type(r), role: r.role}) AS links"
        ),
        {"id": person_id},
    )
    companies = []
    p0_links: List[Dict[str, Any]] = []
    if comp_rows:
        row = comp_rows[0]
        companies = [n for n in (row.get("companies") or []) if n.get("id")]
        p0_links = [
            {k: v for k, v in link.items() if v is not None}
            for link in (row.get("links") or [])
            if link.get("to")
        ]

    # Other persons connected to those companies and their links
    others_rows = run_cypher(
        (
            "MATCH (p0:Entity {id: $id})-[:LEGAL_REP|SERVES_AS]->(c:Entity)<-[r:LEGAL_REP|SERVES_AS]-(p:Entity) "
            "WHERE p.id <> p0.id "
            "RETURN collect(DISTINCT {id: p.id, name: p.name, type: p.type}) AS persons, "
            "       collect(DISTINCT {from: p.id, to: c.id, type: type(r), role: r.role}) AS links, "
            "       collect(DISTINCT {a: p0.id, b: p.id, company: c.id}) AS shared"
        ),
        {"id": person_id},
    )
    others: List[Dict[str, Any]] = []
    other_links: List[Dict[str, Any]] = []
    shared_pairs: List[Dict[str, Any]] = []
    if others_rows:
        row = others_rows[0]
        others = [n for n in (row.get("persons") or []) if n.get("id")]
        other_links = [
            {k: v for k, v in link.items() if v is not None}
            for link in (row.get("links") or [])
            if link.get("to")
        ]
        shared_pairs = [s for s in (row.get("shared") or []) if s.get("a") and s.get("b") and s.get("company")]

    # Build node set
    node_map: Dict[str, Dict[str, Any]] = {}
    def add_node(n: Dict[str, Any]):
        if not n or not n.get("id"):
            return
        nid = n["id"]
        if nid not in node_map:
            node_map[nid] = {"id": nid, "name": n.get("name"), "type": n.get("type")}

    add_node(person_res[0])
    for n in companies:
        add_node(n)
    for n in others:
        add_node(n)

    # Build links, avoid duplicates
    def link_key(l: Dict[str, Any]) -> tuple:
        return (l.get("from"), l.get("to"), l.get("type"), l.get("role"), l.get("company_id"))

    links: List[Dict[str, Any]] = []
    seen = set()
    for l in p0_links + other_links:
        if not l.get("from") or not l.get("to"):
            continue
        item = {"source": l["from"], "target": l["to"], "type": l.get("type"), "role": l.get("role")}
        k = link_key(item)
        if k not in seen:
            seen.add(k)
            links.append(item)

    # Person-person shared company edges
    for s in shared_pairs:
        item = {
            "source": s["a"],
            "target": s["b"],
            "type": "SHARE_COMPANY",
            "company_id": s.get("company"),
        }
        # Normalize undirected by sorting endpoints to avoid duplicates
        undirected_key = tuple(sorted([item["source"], item["target"]]) + [item["type"], item.get("company_id")])
        if undirected_key not in seen:
            seen.add(undirected_key)
            links.append(item)

    return {
        "person": person_res[0],
        "nodes": list(node_map.values()),
        "links": links,
    }
