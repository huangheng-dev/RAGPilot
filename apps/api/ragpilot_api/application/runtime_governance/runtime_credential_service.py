from uuid import UUID

from ragpilot_api.contracts.http.runtime_credential_contracts import RuntimeCredentialRotationResponse
from ragpilot_api.infrastructure.database.repositories.runtime_credential_repository import RuntimeCredentialRepository
from ragpilot_api.infrastructure.security.runtime_credentials import decrypt_runtime_secret, encrypt_runtime_secret
from ragpilot_api.shared.settings import Settings


class RuntimeCredentialService:
    def __init__(self, repository: RuntimeCredentialRepository, settings: Settings) -> None:
        self.repository = repository
        self.settings = settings

    async def rotate(self, *, resource_type: str, resource_id: UUID, secret: str,
                     actor_user_id: UUID | None) -> RuntimeCredentialRotationResponse:
        associated_data = f"{resource_type}:{resource_id}"
        encrypted = encrypt_runtime_secret(
            secret, master_key=self.settings.runtime_credential_master_key, associated_data=associated_data,
        )
        credential = await self.repository.rotate(
            resource_type=resource_type, resource_id=resource_id,
            ciphertext=encrypted.ciphertext, nonce=encrypted.nonce, secret_hint=encrypted.secret_hint,
            actor_user_id=actor_user_id,
        )
        return RuntimeCredentialRotationResponse(
            resource_type=credential.resource_type, resource_id=credential.resource_id,
            secret_hint=credential.secret_hint, key_version=credential.key_version,
            rotated_by_user_id=credential.rotated_by_user_id, rotated_at=credential.rotated_at,
        )

    async def resolve(self, *, resource_type: str, resource_id: UUID) -> str | None:
        credential = await self.repository.get(resource_type=resource_type, resource_id=resource_id)
        if credential is None:
            return None
        return decrypt_runtime_secret(
            ciphertext=credential.ciphertext, nonce=credential.nonce,
            master_key=self.settings.runtime_credential_master_key,
            associated_data=f"{resource_type}:{resource_id}",
        )
