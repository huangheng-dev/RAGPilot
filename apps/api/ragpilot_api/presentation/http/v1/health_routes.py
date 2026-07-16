from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.system.health_service import build_health_response
from ragpilot_api.contracts.http.health_contracts import HealthResponse
from ragpilot_api.infrastructure.database.session import get_database_session


router = APIRouter()


@router.get("", response_model=HealthResponse)
async def get_health_status(session: AsyncSession = Depends(get_database_session)) -> HealthResponse:
    return await build_health_response(session)


@router.get("/live", response_model=dict[str, str])
async def get_liveness() -> dict[str, str]:
    return {"status": "alive"}


@router.get("/ready", response_model=dict[str, str])
async def get_readiness(
    response: Response,
    session: AsyncSession = Depends(get_database_session),
) -> dict[str, str]:
    try:
        await session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready"}
    return {"status": "ready"}
