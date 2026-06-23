from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.application.system.health_service import build_health_response
from ragpilot_api.contracts.http.health_contracts import HealthResponse
from ragpilot_api.infrastructure.database.session import get_database_session


router = APIRouter()


@router.get("", response_model=HealthResponse)
async def get_health_status(session: AsyncSession = Depends(get_database_session)) -> HealthResponse:
    return await build_health_response(session)
