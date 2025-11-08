from typing import List, Dict, Any, Optional
from app.db.neo4j_connector import run_cypher


def create_entity(entity_id: str, name: str = None, type_: str = None) -> Dict[str, Any]:
    """Create or update an Entity node without clobbering existing properties with nulls.

    Behavior:
    - If the node doesn't exist, it will be created; provided non-null name/type are set.
    - If the node exists, only overwrite properties when non-null values are provided.
    """
    query = (
        "MERGE (e:Entity {id: $id}) "
        "SET e.name = coalesce($name, e.name), "
        "    e.type = coalesce($type, e.type) "
        "RETURN e.id AS id, e.name AS name, e.type AS type"
    )
    res = run_cypher(query, {"id": entity_id, "name": name, "type": type_})
    return res[0] if res else {}

def get_entity(entity_id: str) -> Dict[str, Any]:
    """Fetch a single Entity by id. Returns empty dict if not found."""
    q = "MATCH (e:Entity {id: $id}) RETURN e.id AS id, e.name AS name, e.type AS type"
    res = run_cypher(q, {"id": entity_id})
    return res[0] if res else {}


def create_ownership(owner_id: str, owned_id: str, stake: float = None) -> Dict[str, Any]:
    query = (
        "MATCH (a:Entity {id: $owner}), (b:Entity {id: $owned}) "
        "MERGE (a)-[r:OWNS]->(b) "
        "SET r.stake = $stake "
        "RETURN a.id AS owner, b.id AS owned, r.stake AS stake"
    )
    res = run_cypher(query, {"owner": owner_id, "owned": owned_id, "stake": stake})
    return res[0] if res else {}


def get_layers(root_id: str, depth: int = 1) -> Dict[str, Any]:
    # Return nodes and paths from root outgoing OWNS up to depth.
    # Neo4j does not allow parameters/variables inside the variable-length pattern bound,
    # so we use a safe fixed upper bound (e.g., 10) and then filter by length(p) <= $depth.
    query = (
        "MATCH (root:Entity {id: $id}) "
        "OPTIONAL MATCH p = (root)-[:OWNS*1..10]->(n:Entity) "
        "WHERE length(p) <= $depth "
        "WITH root, collect(p) AS paths "
        "UNWIND paths AS p "
        "WITH root, p WHERE p IS NOT NULL "
        "WITH root, p, [node IN nodes(p) | {id: node.id, name: node.name, type: node.type}] AS nodes_list, "
        "[rel IN relationships(p) | {from: startNode(rel).id, to: endNode(rel).id, stake: rel.stake}] AS rels_list "
        "RETURN root.id AS root_id, root.name AS root_name, root.type AS root_type, collect({nodes: nodes_list, rels: rels_list}) AS layers"
    )
    res = run_cypher(query, {"id": root_id, "depth": depth})
    if not res:
        # If no paths, still try to return root basic info
        q2 = "MATCH (r:Entity {id: $id}) RETURN r.id AS root_id, r.name AS root_name, r.type AS root_type"
        r2 = run_cypher(q2, {"id": root_id})
        if r2:
            return {"root": {"id": r2[0].get("root_id"), "name": r2[0].get("root_name"), "type": r2[0].get("root_type")}, "layers": []}
        return {"root": {"id": root_id}, "layers": []}

    row = res[0]
    return {
        "root": {"id": row.get("root_id"), "name": row.get("root_name"), "type": row.get("root_type")},
        "layers": row.get("layers") or [],
    }


def get_equity_penetration(root_id: str, depth: int = 3) -> Dict[str, Any]:
    """Compute equity penetration (look-through ownership) from root to descendants.

    Penetration for a target node along a path is the product of stakes on the path
    treating stake as a percentage (0-100). When multiple distinct paths exist to the same
    target, their penetrations are summed. Root is excluded (paths are length >= 1).

    Returns a dict with root info (if it exists) and an items list sorted by penetration desc.
    """
    # First, confirm root exists and fetch basic info
    root_res = run_cypher(
        "MATCH (r:Entity {id: $id}) RETURN r.id AS id, r.name AS name, r.type AS type",
        {"id": root_id},
    )
    if not root_res:
        return {}

    query = (
        "MATCH (root:Entity {id: $id}) "
        "OPTIONAL MATCH p = (root)-[:OWNS*1..10]->(n:Entity) "
        "WHERE length(p) <= $depth "
        "WITH n, p "
        "WHERE p IS NOT NULL AND n IS NOT NULL "
        "WITH n, reduce(prod = 1.0, r IN relationships(p) | prod * coalesce(r.stake, 100.0)/100.0) AS pen "
        "RETURN n.id AS id, n.name AS name, n.type AS type, sum(pen) AS penetration "
        "ORDER BY penetration DESC"
    )
    rows = run_cypher(query, {"id": root_id, "depth": depth})

    items: List[Dict[str, Any]] = []
    for r in rows:
        # Convert to percentage (0-100)
        pen_pct = (r.get("penetration") or 0.0) * 100.0
        items.append(
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "type": r.get("type"),
                "penetration": pen_pct,
            }
        )

    root = root_res[0]
    return {"root": {"id": root.get("id"), "name": root.get("name"), "type": root.get("type")}, "items": items}


def get_equity_penetration_with_paths(
    root_id: str, depth: int = 3, max_paths: int = 3
) -> Dict[str, Any]:
    """Compute equity penetration and also return explicit investment paths per target.

    For each target node reachable within the given depth via :OWNS, we compute:
    - penetration: sum over paths of product(stake_i/100)
    - paths: up to `max_paths` highest-penetration paths, each with nodes/rels and path_penetration
    """
    # Confirm root exists
    root_res = run_cypher(
        "MATCH (r:Entity {id: $id}) RETURN r.id AS id, r.name AS name, r.type AS type",
        {"id": root_id},
    )
    if not root_res:
        return {}

    query = (
        "MATCH (root:Entity {id: $id}) "
        "OPTIONAL MATCH p = (root)-[:OWNS*1..10]->(n:Entity) "
        "WHERE length(p) <= $depth "
        "WITH n, p "
        "WHERE p IS NOT NULL AND n IS NOT NULL "
        "WITH n, p, "
        "  reduce(prod = 1.0, r IN relationships(p) | prod * coalesce(r.stake, 100.0)/100.0) AS pen, "
        "  [node IN nodes(p) | {id: node.id, name: node.name, type: node.type}] AS nodes_list, "
        "  [rel IN relationships(p) | {from: startNode(rel).id, to: endNode(rel).id, stake: rel.stake}] AS rels_list "
        "RETURN n.id AS id, n.name AS name, n.type AS type, "
        "       sum(pen) AS penetration, "
        "       collect({nodes: nodes_list, rels: rels_list, path_penetration: pen}) AS paths "
        "ORDER BY penetration DESC"
    )
    rows = run_cypher(query, {"id": root_id, "depth": depth})

    items: List[Dict[str, Any]] = []
    for r in rows:
        # Convert total penetration to percentage
        pen_pct = ((r.get("penetration") or 0.0) * 100.0)
        # Sort paths by individual path penetration desc and trim
        paths = r.get("paths") or []
        paths_sorted = sorted(paths, key=lambda x: (x.get("path_penetration") or 0.0), reverse=True)
        top_paths = []
        for p in paths_sorted[: max(0, int(max_paths or 0))]:
            pp = (p.get("path_penetration") or 0.0) * 100.0
            top_paths.append({
                "nodes": p.get("nodes") or [],
                "rels": p.get("rels") or [],
                "path_penetration": pp,
            })
        items.append(
            {
                "id": r.get("id"),
                "name": r.get("name"),
                "type": r.get("type"),
                "penetration": pen_pct,
                "paths": top_paths,
            }
        )

    root = root_res[0]
    return {
        "root": {"id": root.get("id"), "name": root.get("name"), "type": root.get("type")},
        "items": items,
    }


def clear_database() -> Dict[str, Any]:
    """Delete all nodes and relationships from the Neo4j database.

    Returns a small stats dict with counts observed before deletion.
    """
    # Collect counts before deletion (best-effort stats)
    nodes_before = 0
    rels_before = 0
    try:
        nb = run_cypher("MATCH (n) RETURN count(n) AS cnt")
        nodes_before = (nb[0].get("cnt") if nb else 0) or 0
    except Exception:
        pass
    try:
        rb = run_cypher("MATCH ()-[r]-() RETURN count(r) AS cnt")
        rels_before = (rb[0].get("cnt") if rb else 0) or 0
    except Exception:
        pass

    # Perform deletion
    run_cypher("MATCH (n) DETACH DELETE n")

    return {"deleted_nodes": nodes_before, "deleted_relationships": rels_before}


def create_legal_rep(company_id: str, person_id: str, role: Optional[str] = None) -> Dict[str, Any]:
    """Create or update a LEGAL_REP relationship from a Person to a Company.

    We don't strictly enforce labels beyond :Entity; role is optional text.
    """
    query = (
        "MATCH (c:Entity {id: $company}), (p:Entity {id: $person}) "
        "MERGE (p)-[r:LEGAL_REP]->(c) "
        "SET r.role = $role "
        "RETURN p.id AS person_id, c.id AS company_id, r.role AS role"
    )
    res = run_cypher(query, {"company": company_id, "person": person_id, "role": role})
    return res[0] if res else {}


def get_representatives(company_id: str) -> Dict[str, Any]:
    """Return company basic info and its legal representatives (if any)."""
    query = (
        "MATCH (c:Entity {id: $id}) "
        "OPTIONAL MATCH (p:Entity)-[r:LEGAL_REP]->(c) "
        "RETURN c.id AS id, c.name AS name, c.type AS type, "
        "collect({id: p.id, name: p.name, type: p.type, role: r.role}) AS representatives"
    )
    res = run_cypher(query, {"id": company_id})
    if not res:
        return {}
    row = res[0]
    reps = [x for x in (row.get("representatives") or []) if x.get("id")]
    return {
        "company": {"id": row.get("id"), "name": row.get("name"), "type": row.get("type")},
        "representatives": reps,
    }


# --- News helpers ---

def create_news_item(
    entity_id: str,
    title: Optional[str] = None,
    url: Optional[str] = None,
    source: Optional[str] = None,
    published_at: Optional[str] = None,
    summary: Optional[str] = None,
) -> Dict[str, Any]:
    """Create or update a News node and link it to an Entity via HAS_NEWS.

    Uniqueness is enforced by URL (MERGE on News {url}). If URL is missing, we fall back to MERGE on title+published_at.
    """
    if not entity_id:
        return {}
    # Choose a merge key strategy
    if url:
        query = (
            "MATCH (e:Entity {id: $eid}) "
            "MERGE (n:News {url: $url}) "
            "SET n.title = coalesce($title, n.title), "
            "    n.source = coalesce($source, n.source), "
            "    n.published_at = coalesce($published_at, n.published_at), "
            "    n.summary = coalesce($summary, n.summary) "
            "MERGE (e)-[:HAS_NEWS]->(n) "
            "RETURN n.title AS title, n.url AS url, n.source AS source, n.published_at AS published_at, n.summary AS summary"
        )
        params = {
            "eid": entity_id,
            "title": title,
            "url": url,
            "source": source,
            "published_at": published_at,
            "summary": summary,
        }
    else:
        query = (
            "MATCH (e:Entity {id: $eid}) "
            "MERGE (n:News {title: $title, published_at: $published_at}) "
            "SET n.source = coalesce($source, n.source), n.summary = coalesce($summary, n.summary) "
            "MERGE (e)-[:HAS_NEWS]->(n) "
            "RETURN n.title AS title, n.url AS url, n.source AS source, n.published_at AS published_at, n.summary AS summary"
        )
        params = {
            "eid": entity_id,
            "title": title,
            "published_at": published_at,
            "source": source,
            "summary": summary,
        }
    res = run_cypher(query, params)
    return res[0] if res else {}


def get_stored_news(entity_id: str) -> List[Dict[str, Any]]:
    """Return stored (imported) news items linked to the entity."""
    if not entity_id:
        return []
    query = (
        "MATCH (e:Entity {id: $id}) "
        "OPTIONAL MATCH (e)-[:HAS_NEWS]->(n:News) "
        "RETURN collect({title: n.title, url: n.url, source: n.source, published_at: n.published_at, summary: n.summary}) AS items"
    )
    res = run_cypher(query, {"id": entity_id})
    if not res:
        return []
    items = res[0].get("items") or []
    # Filter out empties (nodes may be null if none exist)
    cleaned = [i for i in items if any(v for v in i.values())]
    return cleaned


# --- Extended graph operations (Phase 1) ---

def create_person(
    person_id: str,
    name: Optional[str] = None,
    type_: Optional[str] = None,
    basic_info: Optional[Dict[str, Any]] = None,
    id_info: Optional[Dict[str, Any]] = None,
    job_info: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create or update a Person entity.

    Implementation detail: we MERGE by (:Entity {id}) and add the :Person label,
    so existing nodes created via create_entity() are upgraded without duplication.
    """
    query = (
        "MERGE (e:Entity {id: $id}) "
        "SET e:Person, "
        "    e.name = coalesce($name, e.name), "
        "    e.type = coalesce($type, e.type), "
        "    e.basic_info = coalesce($basic_info, e.basic_info), "
        "    e.id_info = coalesce($id_info, e.id_info), "
        "    e.job_info = coalesce($job_info, e.job_info) "
        "RETURN e.id AS id, e.name AS name, e.type AS type"
    )
    res = run_cypher(
        query,
        {
            "id": person_id,
            "name": name,
            "type": type_,
            "basic_info": basic_info,
            "id_info": id_info,
            "job_info": job_info,
        },
    )
    return res[0] if res else {}


def create_company(
    company_id: str,
    name: Optional[str] = None,
    type_: Optional[str] = None,
    business_info: Optional[Dict[str, Any]] = None,
    status: Optional[str] = None,
    industry: Optional[str] = None,
) -> Dict[str, Any]:
    """Create or update a Company entity with extra attributes."""
    query = (
        "MERGE (e:Entity {id: $id}) "
        "SET e:Company, "
        "    e.name = coalesce($name, e.name), "
        "    e.type = coalesce($type, e.type), "
        "    e.business_info = coalesce($business_info, e.business_info), "
        "    e.status = coalesce($status, e.status), "
        "    e.industry = coalesce($industry, e.industry) "
        "RETURN e.id AS id, e.name AS name, e.type AS type"
    )
    res = run_cypher(
        query,
        {
            "id": company_id,
            "name": name,
            "type": type_,
            "business_info": business_info,
            "status": status,
            "industry": industry,
        },
    )
    return res[0] if res else {}


def create_account(
    owner_id: str,
    account_number: str,
    bank_name: Optional[str] = None,
    balance: Optional[float] = None,
) -> Dict[str, Any]:
    """Create or update an Account node and link it to an owner via HAS_ACCOUNT."""
    query = (
        "MERGE (o:Entity {id: $owner}) "
        "MERGE (a:Account {account_number: $acc}) "
        "SET a.bank_name = coalesce($bank, a.bank_name), "
        "    a.balance = coalesce($bal, a.balance) "
        "MERGE (o)-[:HAS_ACCOUNT]->(a) "
        "RETURN a.account_number AS account_number, a.bank_name AS bank_name, a.balance AS balance"
    )
    res = run_cypher(
        query, {"owner": owner_id, "acc": account_number, "bank": bank_name, "bal": balance}
    )
    return res[0] if res else {}


def create_location_links(
    entity_id: str,
    registered: Optional[str] = None,
    operating: Optional[str] = None,
    offshore: Optional[str] = None,
) -> Dict[str, Any]:
    """Attach location nodes to an entity via REGISTERED_IN / OPERATES_IN / OFFSHORE_IN.

    Location nodes are de-duplicated by name.
    """
    query = (
        "MERGE (e:Entity {id: $id}) "
        # Registered location
        "FOREACH (_ IN CASE WHEN $registered IS NULL OR $registered = '' THEN [] ELSE [1] END | "
        "  MERGE (r:Location {name: $registered}) "
        "  MERGE (e)-[:REGISTERED_IN]->(r) ) "
        # Operating location
        "FOREACH (_ IN CASE WHEN $operating IS NULL OR $operating = '' THEN [] ELSE [1] END | "
        "  MERGE (op:Location {name: $operating}) "
        "  MERGE (e)-[:OPERATES_IN]->(op) ) "
        # Offshore location
        "FOREACH (_ IN CASE WHEN $offshore IS NULL OR $offshore = '' THEN [] ELSE [1] END | "
        "  MERGE (of:Location {name: $offshore}) "
        "  MERGE (e)-[:OFFSHORE_IN]->(of) ) "
        "RETURN e.id AS id"
    )
    res = run_cypher(
        query,
        {"id": entity_id, "registered": registered, "operating": operating, "offshore": offshore},
    )
    return res[0] if res else {}


def create_transaction(
    from_id: str,
    to_id: str,
    amount: float,
    time: Optional[str] = None,
    tx_type: Optional[str] = None,
    channel: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a Transaction node between two entities.

    Pattern: (from)-[:INITIATES]->(t:Transaction {props})-[:TO]->(to)
    """
    query = (
        "MERGE (a:Entity {id: $from}) "
        "MERGE (b:Entity {id: $to}) "
        "CREATE (t:Transaction {amount: $amount, time: $time, type: $type, channel: $channel}) "
        "MERGE (a)-[:INITIATES]->(t) "
        "MERGE (t)-[:TO]->(b) "
        "RETURN t.amount AS amount, t.time AS time, t.type AS type, t.channel AS channel"
    )
    res = run_cypher(
        query,
        {"from": from_id, "to": to_id, "amount": amount, "time": time, "type": tx_type, "channel": channel},
    )
    return res[0] if res else {}


def create_guarantee(
    guarantor_id: str, guaranteed_id: str, amount: float
) -> Dict[str, Any]:
    """Create or update a GUARANTEES relationship with amount."""
    query = (
        "MERGE (g:Entity {id: $guarantor}) "
        "MERGE (b:Entity {id: $guaranteed}) "
        "MERGE (g)-[r:GUARANTEES]->(b) "
        "SET r.amount = $amount "
        "RETURN g.id AS guarantor, b.id AS guaranteed, r.amount AS amount"
    )
    res = run_cypher(query, {"guarantor": guarantor_id, "guaranteed": guaranteed_id, "amount": amount})
    return res[0] if res else {}


def create_supply_link(
    supplier_id: str, customer_id: str, frequency: Optional[int] = None
) -> Dict[str, Any]:
    """Create or update a SUPPLIES_TO relationship with frequency."""
    query = (
        "MERGE (s:Entity {id: $supplier}) "
        "MERGE (c:Entity {id: $customer}) "
        "MERGE (s)-[r:SUPPLIES_TO]->(c) "
        "SET r.frequency = $frequency "
        "RETURN s.id AS supplier, c.id AS customer, r.frequency AS frequency"
    )
    res = run_cypher(query, {"supplier": supplier_id, "customer": customer_id, "frequency": frequency})
    return res[0] if res else {}


def create_employment(
    company_id: str, person_id: str, role: Optional[str] = None
) -> Dict[str, Any]:
    """Create or update a general SERVES_AS employment relation (person -> company)."""
    query = (
        "MERGE (c:Entity {id: $company}) "
        "MERGE (p:Entity {id: $person}) "
        "MERGE (p)-[r:SERVES_AS]->(c) "
        "SET r.role = $role "
        "RETURN p.id AS person_id, c.id AS company_id, r.role AS role"
    )
    res = run_cypher(query, {"company": company_id, "person": person_id, "role": role})
    return res[0] if res else {}


# --- List/Query helpers (Phase 6 additions) ---

def get_accounts(owner_id: str) -> List[Dict[str, Any]]:
    """Return all Account nodes linked from an owner via HAS_ACCOUNT.

    If the owner has no accounts (or doesn't exist), returns an empty list.
    """
    query = (
        "MATCH (o:Entity {id: $id})-[:HAS_ACCOUNT]->(a:Account) "
        "RETURN a.account_number AS account_number, a.bank_name AS bank_name, a.balance AS balance "
        "ORDER BY a.account_number"
    )
    rows = run_cypher(query, {"id": owner_id})
    return rows or []


def get_transactions(entity_id: str, direction: str = "out") -> List[Dict[str, Any]]:
    """Return transactions related to an entity.

    direction semantics:
    - out: entity INITIATES the transaction (entity -> Transaction -> to)
    - in:  entity is the TO target (from -> Transaction -> entity)
    - both: either side (from.id = entity OR to.id = entity)

    Each row includes from_id, to_id, amount, time, type, channel.
    """
    direction = (direction or "out").lower()
    if direction == "in":
        query = (
            "MATCH (from:Entity)-[:INITIATES]->(t:Transaction)-[:TO]->(to:Entity {id: $id}) "
            "RETURN from.id AS from_id, to.id AS to_id, t.amount AS amount, t.time AS time, t.type AS type, t.channel AS channel "
            "ORDER BY coalesce(t.time, '') DESC"
        )
    elif direction == "both":
        query = (
            "MATCH (from:Entity)-[:INITIATES]->(t:Transaction)-[:TO]->(to:Entity) "
            "WHERE from.id = $id OR to.id = $id "
            "RETURN from.id AS from_id, to.id AS to_id, t.amount AS amount, t.time AS time, t.type AS type, t.channel AS channel "
            "ORDER BY coalesce(t.time, '') DESC"
        )
    else:  # default 'out'
        query = (
            "MATCH (from:Entity {id: $id})-[:INITIATES]->(t:Transaction)-[:TO]->(to:Entity) "
            "RETURN from.id AS from_id, to.id AS to_id, t.amount AS amount, t.time AS time, t.type AS type, t.channel AS channel "
            "ORDER BY coalesce(t.time, '') DESC"
        )
    rows = run_cypher(query, {"id": entity_id})
    return rows or []
