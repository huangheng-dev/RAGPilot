from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ragpilot_api.presentation.http.v1.api_router import api_router
from ragpilot_api.shared.settings import get_settings


settings = get_settings()

app = FastAPI(
    title="RagPilot API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Limit", "X-Offset", "X-Result-Count"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["system"])
async def service_root() -> dict[str, str]:
    return {
        "service": settings.service_name,
        "environment": settings.environment,
        "message": "RagPilot API is online.",
    }
