from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.db.neo4j_connector import close_driver

# Routers
from app.api.routers.core import router as core_router
from app.api.routers.entities import router as entities_router
from app.api.routers.analysis import router as analysis_router
from app.api.routers.news import router as news_router
from app.api.routers.network import router as network_router
from app.api.routers.subresources import router as subresources_router
from app.api.routers.risk_kb import router as risk_kb_router
from app.api.routers.reports import router as reports_router
from app.api.routers.chat import router as chat_router
from app.api.routers.persons import router as persons_router
from app.api.routers.external import router as external_router
from app.api.routers.screening import router as screening_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure resources (like the Neo4j driver) are closed on shutdown."""
    try:
        yield
    finally:
        close_driver()


app = FastAPI(title="Ownership Intelligence Platform", version="0.1", lifespan=lifespan)

# Serve static files under /static
app.mount("/static", StaticFiles(directory="static", html=True), name="static")

# Register routers (paths preserved as defined in each module)
app.include_router(core_router)
app.include_router(entities_router)
app.include_router(analysis_router)
app.include_router(news_router)
app.include_router(network_router)
app.include_router(persons_router)
app.include_router(subresources_router)
app.include_router(risk_kb_router)
app.include_router(reports_router)
app.include_router(chat_router)
app.include_router(external_router)
app.include_router(screening_router)
