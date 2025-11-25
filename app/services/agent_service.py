from typing import Any, Dict, List, Optional
import logging
import asyncio

from app.services.llm_client import get_llm_client
from app.services.youtu_service import ask_youtu

logger = logging.getLogger(__name__)

async def classify_intent(message: str) -> str:
    """
    Classify the user's message into 'person', 'company', or 'general'.
    """
    client = get_llm_client()
    prompt = f"""
    You are a classifier. Determine if the user is asking for a "Personal Information Check" (person) or "Corporate Information Check" (company).
    
    If the query is about a specific person, their background, relationships, or risk, return 'person'.
    If the query is about a company, its structure, shareholders, transactions, or risk, return 'company'.
    If it is unclear or general, return 'general'.
    
    Only return the label: person, company, or general.
    
    User Query: {message}
    """
    
    try:
        text, _, _ = client.generate([{"role": "user", "content": prompt}], temperature=0.0, max_tokens=10)
        label = text.strip().lower()
        if "person" in label:
            return "person"
        if "company" in label:
            return "company"
        return "general"
    except Exception as e:
        logger.error(f"Error classifying intent: {e}")
        return "general"

async def run_person_agent(message: str) -> Dict[str, Any]:
    """
    Agent for Personal Information Check.
    Focuses on personal relationship networks.
    """
    # Enhance prompt for person check
    # We can append specific instructions to the query sent to Youtu if Youtu supports it,
    # or just rely on the user's message. 
    # Since Youtu API takes a "question", we can refine it.
    
    refined_question = f"{message} 请重点分析该人员的个人关系网络、关联实体及潜在风险。"
    
    # Call Youtu
    youtu_resp = await ask_youtu(refined_question)
    
    # Construct response
    return {
        "reply": youtu_resp.get("answer", ""),
        "model": "agent-person",
        "agent_type": "person",
        "youtu_data": youtu_resp,
        "graphs": [
            {
                "title": "个人关系网络 (Personal Network)",
                "triples": youtu_resp.get("retrieved_triples", [])
            }
        ]
    }

async def run_company_agent(message: str) -> Dict[str, Any]:
    """
    Agent for Corporate Information Check.
    Focuses on corporate structure, equity penetration, and transactions.
    Tries to fetch multiple aspects if possible.
    """
    # Strategy: We want "Equity/Structure" and "Transactions".
    # We could try two parallel calls to Youtu with different focuses.
    
    q1 = f"{message} 请重点分析该企业的股权结构、股东信息及穿透层级。"
    q2 = f"{message} 请重点分析该企业的对外投资、交易往来及供应链信息。"
    
    # Run in parallel
    resp1, resp2 = await asyncio.gather(
        ask_youtu(q1),
        ask_youtu(q2)
    )
    
    # Combine answers? Or just use the first one as main summary?
    # Let's combine them or just use the first one if it's good.
    # Or maybe ask LLM to synthesize?
    # For simplicity, we'll concatenate the answers or just use the first one.
    # But we definitely want both graphs.
    
    combined_reply = f"**股权结构分析:**\n{resp1.get('answer', '')}\n\n**交易与投资分析:**\n{resp2.get('answer', '')}"
    
    return {
        "reply": combined_reply,
        "model": "agent-company",
        "agent_type": "company",
        "youtu_data": resp1, # Keep one as primary for fallback
        "graphs": [
            {
                "title": "股权结构 (Equity Structure)",
                "triples": resp1.get("retrieved_triples", [])
            },
            {
                "title": "交易与投资 (Transactions & Investment)",
                "triples": resp2.get("retrieved_triples", [])
            }
        ]
    }

async def run_general_agent(message: str) -> Dict[str, Any]:
    """
    Default fallback agent.
    """
    youtu_resp = await ask_youtu(message)
    return {
        "reply": youtu_resp.get("answer", ""),
        "model": "agent-general",
        "agent_type": "general",
        "youtu_data": youtu_resp,
        "graphs": [
            {
                "title": "关联网络 (Relationship Network)",
                "triples": youtu_resp.get("retrieved_triples", [])
            }
        ]
    }
