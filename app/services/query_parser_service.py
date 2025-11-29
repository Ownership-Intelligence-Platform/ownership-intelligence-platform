from __future__ import annotations

"""LLM-powered query parser for person/entity resolution.

This module takes free-form user text (e.g. "李辉 1992-03-25 杭州西湖那位") and
extracts structured fields that can be used as filters for graphRAG
(`resolve_graphrag`).
"""

import json
from typing import Any, Dict

from app.services.llm_client import get_llm_client


_SYSTEM_PROMPT = """你是一个客户尽调系统的助手。
用户会用中文或英文输入一段关于某个自然人或实体的描述，包括姓名、生日、性别、地址、证件号等。
你的任务是从中抽取用于数据库检索的结构化字段，并严格输出 JSON。

字段定义（即使为空也必须提供）：
- name: 姓名，字符串。如果无法确定，使用 null。
- birth_date: 出生日期，格式优先为 "YYYY-MM-DD"，如果只有年份则用 "YYYY"，否则为 null。
- gender: "男" / "女" / null。
- address_keywords: 字符串数组，用于匹配地址关键词（城市、区、街道等）。如果没有则为空数组 []。
- id_number_tail: 如果用户描述中出现了身份证号或类似号码，提取后 4 位，否则为 null。

只输出 JSON，不要输出任何解释性文本。"""


def parse_person_query(user_text: str) -> Dict[str, Any]:
    """Parse free-form user text into structured query fields using the LLM.

    Returns a dict with keys: name, birth_date, gender, address_keywords,
    id_number_tail. Callers should be robust to missing/None values.
    """
    client = get_llm_client()
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"用户输入：{user_text}\n请按照约定的 JSON 结构返回。不要输出解释文字。",
        },
    ]
    try:
        text, usage, model = client.generate(messages, temperature=0.1, max_tokens=400)
    except Exception as exc:
        # If the LLM call fails (timeout, network, key issue), fall back to a safe minimal parse
        return {
            "name": user_text.strip() or None,
            "birth_date": None,
            "gender": None,
            "address_keywords": [],
            "id_number_tail": None,
            "_raw": f"<llm-error>: {exc}",
        }
    # Best-effort JSON parsing; if it fails, fall back to minimal structure.
    try:
        parsed = json.loads(text)
    except Exception:
        return {
            "name": user_text.strip() or None,
            "birth_date": None,
            "gender": None,
            "address_keywords": [],
            "id_number_tail": None,
            "_raw": text,
        }

    # Normalise minimal shape
    name = parsed.get("name") if isinstance(parsed, dict) else None
    birth_date = parsed.get("birth_date") if isinstance(parsed, dict) else None
    gender = parsed.get("gender") if isinstance(parsed, dict) else None
    address_keywords = parsed.get("address_keywords") if isinstance(parsed, dict) else []
    id_tail = parsed.get("id_number_tail") if isinstance(parsed, dict) else None

    if not isinstance(address_keywords, list):
        address_keywords = []

    return {
        "name": name or None,
        "birth_date": birth_date or None,
        "gender": gender or None,
        "address_keywords": [str(x) for x in address_keywords if x],
        "id_number_tail": id_tail or None,
        "_raw": parsed,
    }
