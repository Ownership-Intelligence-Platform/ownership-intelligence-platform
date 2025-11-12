from fastapi import APIRouter, HTTPException
from typing import Any, Dict, List, Optional

from app.services.risk_service import load_kb, evaluate_kb_risk
from app.services.graph_service import get_entity
from app.db.neo4j_connector import run_cypher

router = APIRouter(tags=["kb-risk"]) 

@router.get("/kb/rules")
def get_kb_rules():
    kb = load_kb()
    return {"rules": kb.get("rules", {}), "lists": kb.get("lists", {}), "taxonomy": kb.get("taxonomy", {})}

@router.post("/risk/evaluate")
def post_risk_evaluate(payload: Dict[str, Any]):
    if not payload:
        raise HTTPException(status_code=400, detail="Missing payload")
    # If entity_id provided but not found, return 404 for clarity
    ent_id = payload.get("entity_id")
    if ent_id:
        ent = get_entity(ent_id)
        if not ent:
            raise HTTPException(status_code=404, detail="Entity not found")
    try:
        result = evaluate_kb_risk(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Evaluation error: {exc}")
    return result

@router.post("/risk/annotate-graph")
def post_annotate_graph(payload: Dict[str, Any]):
    entity_ids: List[str] = payload.get("entity_ids") if isinstance(payload, dict) else None
    if not entity_ids:
        raise HTTPException(status_code=400, detail="Provide entity_ids: [id, ...]")

    updated = 0
    for eid in entity_ids:
        ent = get_entity(eid)
        if not ent:
            continue
        # Minimal evaluation using entity only (could be extended to pull recent transfers from graph)
        eval_result = evaluate_kb_risk({"entity_id": eid})
        score = float(eval_result.get("score", 0.0))
        labels = eval_result.get("labels", [])
        det = eval_result.get("deterministic_triggers", [])
        # Write back to Neo4j as node properties
        cypher = (
            "MATCH (e:Entity {id: $id}) "
            "SET e.risk_score = $score, e.risk_labels = $labels, e.risk_deterministic = $det RETURN e.id as id"
        )
        try:
            res = run_cypher(cypher, {"id": eid, "score": score, "labels": labels, "det": det})
            if res:
                updated += 1
        except Exception:
            # Ignore write failures in MVP; continue
            pass

    return {"updated": updated}
