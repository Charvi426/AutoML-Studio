from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.auth import router as auth_router
from src.api.datasets import router as datasets_router
from src.api.explainability import router as explainability_router
from src.api.predictions import router as predictions_router
from src.api.projects import router as projects_router
from src.api.training import router as training_router
from src.database import models  # noqa: F401 (registers tables on Base.metadata)
from src.database.session import Base, engine
from src.utils.config import settings

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(datasets_router)
app.include_router(training_router)
app.include_router(explainability_router)
app.include_router(predictions_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}
