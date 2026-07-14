import base64
import hashlib
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


@dataclass(frozen=True)
class EncryptedSecret:
    ciphertext: str
    nonce: str
    secret_hint: str


def encrypt_runtime_secret(secret: str, *, master_key: str, associated_data: str) -> EncryptedSecret:
    if len(master_key) < 32:
        raise ValueError("Runtime credential master key must contain at least 32 characters.")
    if not secret:
        raise ValueError("Runtime credential cannot be empty.")
    key = hashlib.sha256(master_key.encode("utf-8")).digest()
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, secret.encode("utf-8"), associated_data.encode("utf-8"))
    return EncryptedSecret(
        ciphertext=base64.urlsafe_b64encode(ciphertext).decode("ascii"),
        nonce=base64.urlsafe_b64encode(nonce).decode("ascii"),
        secret_hint=f"••••{secret[-4:]}" if len(secret) >= 4 else "••••",
    )


def decrypt_runtime_secret(*, ciphertext: str, nonce: str, master_key: str, associated_data: str) -> str:
    key = hashlib.sha256(master_key.encode("utf-8")).digest()
    plaintext = AESGCM(key).decrypt(
        base64.urlsafe_b64decode(nonce),
        base64.urlsafe_b64decode(ciphertext),
        associated_data.encode("utf-8"),
    )
    return plaintext.decode("utf-8")
