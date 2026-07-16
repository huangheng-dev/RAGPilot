from uuid import uuid4

import pytest
from cryptography.exceptions import InvalidTag

from ragpilot_api.contracts.http.runtime_credential_contracts import (
    RuntimeCredentialRotateRequest,
    RuntimeCredentialRotationResponse,
)
from ragpilot_api.infrastructure.security.runtime_credentials import decrypt_runtime_secret, encrypt_runtime_secret


MASTER_KEY = "test-runtime-credential-master-key-at-least-32-characters"


def test_runtime_secret_round_trip_uses_authenticated_encryption() -> None:
    resource_id = uuid4()
    associated_data = f"model_endpoint:{resource_id}"
    secret = "provider-secret-value-1234"

    encrypted = encrypt_runtime_secret(secret, master_key=MASTER_KEY, associated_data=associated_data)

    assert secret not in encrypted.ciphertext
    assert encrypted.secret_hint == "••••1234"
    assert decrypt_runtime_secret(
        ciphertext=encrypted.ciphertext,
        nonce=encrypted.nonce,
        master_key=MASTER_KEY,
        associated_data=associated_data,
    ) == secret


def test_runtime_secret_cannot_be_moved_to_another_resource() -> None:
    encrypted = encrypt_runtime_secret(
        "isolated-secret", master_key=MASTER_KEY, associated_data=f"mcp_connector:{uuid4()}"
    )

    with pytest.raises(InvalidTag):
        decrypt_runtime_secret(
            ciphertext=encrypted.ciphertext,
            nonce=encrypted.nonce,
            master_key=MASTER_KEY,
            associated_data=f"mcp_connector:{uuid4()}",
        )


def test_rotation_request_hides_secret_from_repr_and_response_contract() -> None:
    request = RuntimeCredentialRotateRequest(secret="never-log-this-secret")

    assert "never-log-this-secret" not in repr(request)
    assert "secret" not in RuntimeCredentialRotationResponse.model_fields
