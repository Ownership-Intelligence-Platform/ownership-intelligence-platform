"""Report generation service (CDD snapshot).

Assembles a structured bundle for an entity and generates a markdown report
via an LLM (with deterministic fallback when the LLM is unavailable).
"""

from __future__ import annotations

import io
import os
import time
from typing import Any, Dict, List, Optional

from app.services.llm_client import get_llm_client
import app.services.graph_service as graph_service
import app.services.risk_service as risk_service
import app.services.news_service as news_service
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from xhtml2pdf import pisa
from xhtml2pdf.default import DEFAULT_FONT


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
STATIC_FONTS_DIR = os.path.join(ROOT_DIR, "static", "fonts")


def _ensure_reports_dir() -> str:
    out_dir = os.path.join(ROOT_DIR, "reports")
    os.makedirs(out_dir, exist_ok=True)
    return out_dir


def _get_static_file(*parts: str) -> str:
    return os.path.join(ROOT_DIR, *parts)


def _register_pdf_fonts() -> None:
    if getattr(_register_pdf_fonts, "_done", False):
        return

    fonts = [
        ("SimHei", "Simhei.ttf"),
        ("MicrosoftYaHei", "msyh.ttf"),
    ]
    for family, filename in fonts:
        font_path = os.path.join(STATIC_FONTS_DIR, filename)
        if not os.path.isfile(font_path):
            continue
        try:
            if family not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont(family, font_path))
            DEFAULT_FONT[family.lower()] = family
            DEFAULT_FONT[family.replace("YaHei", " YaHei").lower()] = family
            if family == "MicrosoftYaHei":
                DEFAULT_FONT["microsoft yahei"] = family
                DEFAULT_FONT["yahei"] = family
            if family == "SimHei":
                DEFAULT_FONT["simhei"] = family
                DEFAULT_FONT["sim hei"] = family
        except Exception:
            continue

    _register_pdf_fonts._done = True


def _xhtml2pdf_link_callback(uri: str, rel: str) -> str:
    if uri.startswith("file://"):
        from urllib.parse import urlparse, unquote

        parsed = urlparse(uri)
        path = unquote(parsed.path)
        if os.name == "nt" and path.startswith("/"):
            path = path[1:]
        return path

    if uri.startswith("http://") or uri.startswith("https://"):
        return uri

    abs_path = _get_static_file(uri)
    if os.path.isfile(abs_path):
        return abs_path
    return uri


def _render_pdf_with_xhtml2pdf(html_content: str) -> bytes:
    pdf_buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(
        io.StringIO(html_content),
        dest=pdf_buffer,
        encoding="utf-8",
        link_callback=_xhtml2pdf_link_callback,
    )
    if pisa_status.err:
        raise RuntimeError("PDF generation failed")
    return pdf_buffer.getvalue()


def _build_bundle(entity_id: str, *, depth: int = 3, news_limit: int = 10) -> Dict[str, Any]:
    entity = graph_service.get_entity(entity_id)
    if not entity:
        return {}

    # Ownership penetration
    penetration = graph_service.get_equity_penetration(entity_id, depth)

    # Risk analysis (rule-based)
    risk = risk_service.analyze_entity_risks(entity_id, news_limit=news_limit)

    # News: stored + external summary items
    stored_news = graph_service.get_stored_news(entity_id)
    query_name = entity.get("name") or entity_id
    external_news = news_service.get_company_news(query_name, limit=news_limit)

    return {
        "entity": entity,
        "penetration": penetration,
        "risk": risk,
        "news": {
            "stored": stored_news,
            "external": external_news,
        },
        "meta": {
            "depth": depth,
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        },
    }


def _truncate_text(text: str, max_chars: int = 12000) -> str:
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 20] + "\n...[truncated]"


def _build_prompt(bundle: Dict[str, Any], *, bilingual: bool = False) -> List[Dict[str, str]]:
    e = bundle.get("entity", {})
    pen = bundle.get("penetration", {}) or {}
    risk = bundle.get("risk", {}) or {}
    news = bundle.get("news", {}) or {}
    meta = bundle.get("meta", {}) or {}

    entity_block = _truncate_text(str({
        "id": e.get("id"),
        "name": e.get("name"),
        "type": e.get("type"),
        "description": e.get("description"),
    }))
    penetration_block = _truncate_text(str(pen))
    risk_block = _truncate_text(str({
        "summary": risk.get("summary"),
        "thresholds": risk.get("thresholds"),
        "top_counts": {
            "total_items": (risk.get("summary", {}) or {}).get("total_items"),
            "total_risky_items": (risk.get("summary", {}) or {}).get("total_risky_items"),
            "overall_risk_score": (risk.get("summary", {}) or {}).get("overall_risk_score"),
        },
    }))
    news_items = (news.get("stored") or []) + (news.get("external") or [])
    news_preview = [
        {"title": n.get("title"), "source": n.get("source"), "published_at": n.get("published_at")}
        for n in news_items[:20]
    ]
    news_block = _truncate_text(str(news_preview))

    if bilingual:
        sys = (
            "You are a bilingual (Chinese+English) analyst assistant for due diligence. "
            "Write concise, factual, auditable reports. Avoid hallucinations; only use provided data."
        )
        instructions = (
            "Generate a CDD snapshot report in Markdown with the following sections: \n"
            "1) Summary 概览\n"
            "2) Ownership Look-through 股权穿透 (depth={{depth}})\n"
            "3) Key Risks 关键风险点 (with brief rationale)\n"
            "4) News Brief 新闻摘要 (with sources)\n"
            "5) Recommendations 建议 (e.g., Normal, Manual Review, Enhanced DD).\n"
            "Use bullet points and short paragraphs. If data is missing, state it explicitly."
        )
    else:
        sys = (
            "You are a due-diligence analyst. Write concise, factual, auditable reports. "
            "Avoid speculation; only use provided context."
        )
        instructions = (
            "Generate a CDD snapshot report in Markdown with sections: Summary, Ownership Look-through, "
            "Key Risks, News Brief, Recommendations. Use bullet points and short paragraphs."
        )

    user_content = (
        f"INSTRUCTIONS:\n{instructions}\n\n"
        f"META: {meta}\n\n"
        f"ENTITY:\n{entity_block}\n\n"
        f"OWNERSHIP_PENETRATION:\n{penetration_block}\n\n"
        f"RISK:\n{risk_block}\n\n"
        f"NEWS_PREVIEW (max 20):\n{news_block}\n\n"
        "Return only Markdown."
    )

    return [
        {"role": "system", "content": sys},
        {"role": "user", "content": user_content},
    ]


def _render_fallback_markdown(bundle: Dict[str, Any]) -> str:
    e = bundle.get("entity", {})
    pen = bundle.get("penetration", {}) or {}
    risk = bundle.get("risk", {}) or {}
    news = bundle.get("news", {}) or {}
    meta = bundle.get("meta", {}) or {}

    summ = risk.get("summary", {}) or {}
    news_items = (news.get("stored") or []) + (news.get("external") or [])

    lines = []
    lines.append(f"# CDD Snapshot — {e.get('name') or e.get('id')}")
    lines.append("")
    lines.append(f"Generated: {meta.get('generated_at')} (depth={meta.get('depth')})")
    lines.append("")
    lines.append("## Summary")
    lines.append(f"- Entity ID: {e.get('id')}")
    if e.get("name"):
        lines.append(f"- Name: {e.get('name')}")
    if e.get("type"):
        lines.append(f"- Type: {e.get('type')}")
    if e.get("description"):
        lines.append(f"- Description: {e.get('description')}")

    lines.append("")
    lines.append("## Ownership Look-through")
    lines.append("```")
    lines.append(str(pen))
    lines.append("```")

    lines.append("")
    lines.append("## Key Risks")
    lines.append(f"- Total related items: {summ.get('total_items')}")
    lines.append(f"- Risky items: {summ.get('total_risky_items')}")
    lines.append(f"- Overall risk score: {summ.get('overall_risk_score')}")

    lines.append("")
    lines.append("## News Brief (first 10)")
    for n in news_items[:10]:
        title = n.get("title") or "(no title)"
        src = n.get("source") or ""
        url = n.get("url") or ""
        pub = n.get("published_at") or ""
        lines.append(f"- {title} ({src}, {pub}) {url}")

    lines.append("")
    lines.append("## Recommendations")
    lines.append("- Manual Review recommended (LLM unavailable).")

    return "\n".join(lines)


def generate_cdd_report(
    entity_id: str,
    *,
    refresh: bool = False,
    depth: int = 3,
    news_limit: int = 10,
    bilingual: bool = False,
    as_html: bool = False,
) -> Dict[str, Any]:
    bundle = _build_bundle(entity_id, depth=depth, news_limit=news_limit)
    if not bundle:
        return {}

    out_dir = _ensure_reports_dir()
    md_path = os.path.join(out_dir, f"{entity_id}.md")
    if os.path.isfile(md_path) and not refresh:
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"entity_id": entity_id, "cached": True, "path": md_path, "content": content}

    # Try LLM generation
    content = None
    model_used = None
    usage = {}
    try:
        client = get_llm_client()
        messages = _build_prompt(bundle, bilingual=bilingual)
        text, usage, model_used = client.generate(messages, temperature=0.2, max_tokens=1600)
        content = text.strip() if text else None
    except Exception:
        content = None

    if not content:
        content = _render_fallback_markdown(bundle)

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(content)

    result = {
        "entity_id": entity_id,
        "cached": False,
        "path": md_path,
        "content": content,
        "model": model_used,
        "usage": usage,
    }

    if as_html:
        # Derive a readable title
        title = f"CDD Snapshot — {bundle['entity'].get('name') or entity_id}"
        html = _markdown_to_html(content, title=title)
        html_path = md_path[:-3] + ".html" if md_path.endswith(".md") else md_path + ".html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        result.update({
            "path_html": html_path,
            "content_html": html,
        })

    return result


def _markdown_to_html(markdown_text: str, *, title: str = "CDD Snapshot") -> str:
    """Convert Markdown to a standalone HTML document with minimal styling."""

    doc_body: str
    try:
        import markdown  # type: ignore

        doc_body = markdown.markdown(
            markdown_text,
            extensions=["extra", "sane_lists", "toc"],
            output_format="html5",
        )
    except Exception:
        import html as _html

        escaped = _html.escape(markdown_text)
        doc_body = f"<pre>{escaped}</pre>"

    styles = """
    :root { color-scheme: light dark; }
    body { margin: 0; font-family: "Microsoft YaHei", "SimHei", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
                 background: #f8fafc; color: #0f172a; }
    .container { max-width: 940px; margin: 2rem auto; padding: 0 1rem; }
    .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.10);
                    padding: 24px; border: 1px solid #e5e7eb; }
    h1, h2, h3 { color: #0f172a; }
    h1 { font-size: 1.75rem; margin-top: 0; }
    h2 { font-size: 1.25rem; margin-top: 1.5rem; }
    h3 { font-size: 1.1rem; margin-top: 1.25rem; }
    p { line-height: 1.5; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    pre { background: #0b1220; color: #e2e8f0; padding: 12px; border-radius: 8px; overflow: auto; }
    ul, ol { padding-left: 1.25rem; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    @media (prefers-color-scheme: dark) {
        body { background: #0b1220; color: #e5e7eb; }
        .card { background: #0f172a; border-color: #1f2937; }
        h1, h2, h3 { color: #e5e7eb; }
        a { color: #93c5fd; }
    }
    """

    return f"""
<!doctype html>
<html lang=\"en\">
<head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>{title}</title>
    <style>{styles}</style>
    <meta name=\"generator\" content=\"Ownership Intelligence Platform\" />
</head>
<body>
    <div class=\"container\">
        <div class=\"card\">
            {doc_body}
        </div>
    </div>
    <!-- Optional: inline print styles -->
    <style>@media print {{ .card {{ box-shadow: none; border: none; }} }}</style>
</body>
<html>
"""


def _markdown_to_pdf_ready_html(markdown_text: str, *, title: str) -> str:
    try:
        import markdown  # type: ignore

        html_body = markdown.markdown(
            markdown_text,
            extensions=["extra", "sane_lists"],
            output_format="html5",
        )
    except Exception:
        import html as _html

        html_body = f"<pre>{_html.escape(markdown_text)}</pre>"

    _register_pdf_fonts()
    font_stack = "'SimHei', 'MicrosoftYaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft JhengHei', 'Heiti SC', 'Arial Unicode MS', sans-serif"
    styles = """
    @page {
        size: A4;
        margin: 2cm;
    }

    body {
        font-size: 11pt;
        line-height: 1.6;
        background: #ffffff;
        color: #111827;
        font-family: FONT_STACK;
    }

    h1, h2, h3 {
        color: #111827;
        margin-top: 1.2em;
        margin-bottom: 0.4em;
        font-family: inherit;
    }

    h1 { font-size: 18pt; }
    h2 { font-size: 14pt; }
    h3 { font-size: 12pt; }

    p { margin: 0 0 0.8em 0; }
    ul, ol { margin: 0 0 0.8em 1.4em; }

    table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
        font-size: 10pt;
    }

    th, td {
        border: 1px solid #e5e7eb;
        padding: 4px 6px;
    }

    code, pre {
        font-family: "Courier New", Courier, monospace;
        font-size: 9pt;
    }

    pre {
        white-space: pre-wrap;
        background: #f3f4f6;
        border-radius: 4px;
        padding: 6px 8px;
    }
    """

    return f"""<!doctype html>
<html lang=\"zh-CN\">
<head>
    <meta charset=\"utf-8\" />
    <title>{title}</title>
    <style>
        {styles.replace("FONT_STACK", font_stack)}
    </style>
</head>
<body>
    <h1>{title}</h1>
    {html_body}
</body>
</html>
"""


def _render_youtu_markdown_fallback(data: Dict[str, Any], *, error: Optional[str] = None) -> str:
    reply = (data.get("reply") or "").strip()
    youtu = data.get("youtu_data", {}) or {}
    triples = youtu.get("retrieved_triples", []) or []
    chunks = youtu.get("retrieved_chunks", []) or []
    model = data.get("model") or "未知模型"

    lines = ["# Intelligence Briefing（本地摘要）", ""]
    if error:
        lines.append(f"> ⚠️ 无法连接 LLM：{error}\n")

    lines.append("## Query Response / 查询回答")
    lines.append(reply or "（无可用摘要，可能仅有结构化数据）")
    lines.append("")

    lines.append("## Key Triples / 关键三元组")
    if triples:
        for h, r, t in triples[:20]:
            lines.append(f"- {h} —{r}→ {t}")
    else:
        lines.append("- （未检索到关联三元组）")
    lines.append("")

    lines.append("## Context Chunks / 背景片段")
    if chunks:
        for idx, chunk in enumerate(chunks[:10], start=1):
            lines.append(f"{idx}. {chunk}")
    else:
        lines.append("- （暂无文本片段）")
    lines.append("")

    lines.append("## Source & Model")
    lines.append(f"- Model / 模型: {model}")
    if error:
        lines.append("- 说明: 已使用本地数据生成简要报告，建议稍后重试 LLM。")

    return "\n".join(lines)


def generate_youtu_pdf(data: Dict[str, Any]) -> bytes:
    """
    Generates a PDF report for Youtu GraphRAG results.
    1. Summarizes data via LLM.
    2. Converts to HTML.
    3. Converts to PDF.
    """
    # 1. Build Prompt
    reply = data.get("reply", "")
    triples = data.get("youtu_data", {}).get("retrieved_triples", [])
    chunks = data.get("youtu_data", {}).get("retrieved_chunks", [])
    model = data.get("model", "youtu-graphrag")

    # Format chunks for prompt
    chunks_text = ""
    for i, c in enumerate(chunks[:10]): # Limit to 10 chunks
        chunks_text += f"[{i+1}] {c}\n"

    prompt = f"""
    You are a professional intelligence analyst.
    Please generate a comprehensive report based on the following GraphRAG search results.
    
    QUERY RESPONSE:
    {reply}

    RETRIEVED KNOWLEDGE (Triples):
    {triples[:20]}

    RETRIEVED CONTEXT (Chunks):
    {chunks_text}

    INSTRUCTIONS:
    - Create a formal report titled "Intelligence Briefing".
    - Sections: Executive Summary, Key Findings, Detailed Analysis, Source References.
    - Use professional formatting (Markdown).
    - Highlight key entities and relationships found in the triples.
    - Synthesize the chunks into a coherent narrative.
    - If the input content is in Chinese, generate the report in Chinese. Otherwise, use English.
    - Output ONLY the Markdown content.
    """

    # 2. Call LLM
    content = ""
    fallback_error: Optional[str] = None
    try:
        client = get_llm_client()
        messages = [{"role": "user", "content": prompt}]
        text, _, _ = client.generate(messages, temperature=0.3, max_tokens=2000)
        content = text.strip() if text else ""
        if not content:
            fallback_error = "LLM returned empty content"
    except Exception as e:
        fallback_error = str(e)
        content = ""

    if not content:
        content = _render_youtu_markdown_fallback(data, error=fallback_error)

    # 3. Convert to HTML with embedded fonts suitable for Chinese text
    html_content = _markdown_to_pdf_ready_html(content, title="Intelligence Briefing")

    # 4. Convert to PDF through xhtml2pdf with link callback/font-face support
    return _render_pdf_with_xhtml2pdf(html_content)
