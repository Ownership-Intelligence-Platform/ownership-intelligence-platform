import httpx
import traceback
from typing import Dict, Any, Optional

YOUTU_API_URL = "http://47.110.75.245:8003/api/ask-question"
# Token from user provided curl command
YOUTU_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijg5ZTk1NzZjLTQzN2EtNDgyNC1hMGVlLTBiYWVmNTE2ZDlhMiIsImV4cCI6MTc2NjQ5NTA0NCwianRpIjoiNGE0YjNkM2YtZTUzMy00MjhkLWExMGItNDM5NmUzYWNmYTlmIn0.eB7Jkwdp_8biQNN_hXpv0s4vq8RjSSOM3gillWi7dlk"

async def ask_youtu(question: str) -> Dict[str, Any]:
    """
    Query the Youtu GraphRAG API.
    """
    headers = {
        # "Accept": "application/json, text/plain, */*",
        # "Content-Type": "application/json",
        # "Cookie": f"token={YOUTU_TOKEN}",
        # "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0"
    }
    
    payload = {
        "question": question,
        "dataset_name": "test1_1"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{YOUTU_API_URL}?client_id=web_client",
                headers=headers,
                json=payload,
                timeout=120.0
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            print(f"HTTP error calling Youtu API: {e.response.status_code} - {e.response.text}")
            return {
                "answer": f"Error calling Youtu GraphRAG (HTTP {e.response.status_code}): {e.response.text}",
                "retrieved_triples": [],
                "retrieved_chunks": []
            }
        except Exception as e:
            traceback.print_exc()
            print(f"Error calling Youtu API: {repr(e)}")
            return {
                "answer": f"Error calling Youtu GraphRAG: {repr(e)}",
                "retrieved_triples": [],
                "retrieved_chunks": []
            }
