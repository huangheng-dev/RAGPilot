from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class RuntimeCredentialRotateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    secret: str = Field(min_length=1, max_length=16000, repr=False)


class RuntimeCredentialRotationResponse(BaseModel):
    resource_type: str
    resource_id: UUID
    secret_hint: str
    key_version: int
    rotated_by_user_id: UUID | None
    rotated_at: datetime
