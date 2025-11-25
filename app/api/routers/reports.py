from fastapi import APIRouter, HTTPException, Response
from app.services.report_service import generate_cdd_report, generate_youtu_pdf
from app.models.export import YoutuReportRequest

router = APIRouter(tags=["reports"])


@router.post("/reports/youtu-pdf")
def api_generate_youtu_pdf(request: YoutuReportRequest):
    try:
        pdf_bytes = generate_youtu_pdf(request.dict())
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=intelligence_briefing.pdf"}
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {exc}")


@router.get("/reports/cdd/{entity_id}")
def api_get_cdd_report(
    entity_id: str,
    refresh: bool = False,
    depth: int = 3,
    news_limit: int = 10,
    bilingual: bool = False,
    format: str = "md",
):
    try:
        as_html = (format or "md").lower() == "html"
        res = generate_cdd_report(
            entity_id,
            refresh=refresh,
            depth=depth,
            news_limit=news_limit,
            bilingual=bilingual,
            as_html=as_html,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {exc}")
    if not res:
        raise HTTPException(status_code=404, detail="Entity not found")
    return res
