"""
Vetted OAuth Token & Runtime Secret Security Helpers
Uses `cryptography` AES-256-GCM AEAD + HKDF-SHA256 for encrypting OAuth tokens
before persisting to SQLite, eliminating custom crypto and hardcoded fallback keys.
"""

import base64
import json
import os
import re
import secrets
import subprocess
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from env_loader import load_env_file

_PREFIX = "enc:v2:aes256gcm:"
_DEFAULT_AAD = b"socialsync:oauth_token:v2"
_SECRETS_FILE = Path(__file__).resolve().parent / ".local_secrets.json"
_PLACEHOLDER_PREFIXES = ("replace_with_", "your_", "changeme")


def get_windows_acl_commands(target_path: str | Path) -> list[str]:
    """Builds exact icacls arguments to strip inheritance and restrict access to current user, Administrators, and SYSTEM."""
    user_name = os.environ.get("USERNAME", "").strip()
    user_domain = os.environ.get("USERDOMAIN", "").strip()
    principal = f"{user_domain}\\{user_name}" if user_domain and user_name else user_name
    args = [str(target_path), "/inheritance:r"]
    if principal:
        args.extend(["/grant:r", f"{principal}:(F)"])
    args.extend(["/grant:r", "NT AUTHORITY\\SYSTEM:(F)", "/grant:r", "BUILTIN\\Administrators:(F)"])
    return args


def harden_file_permissions(target_path: str | Path) -> bool:
    """Restricts file permissions to the owning account (chmod 0600 on POSIX, private NTFS ACL on Windows)."""
    path_obj = Path(target_path)
    if not path_obj.exists():
        return False

    if sys.platform == "win32":
        icacls_args = get_windows_acl_commands(path_obj)
        try:
            res = subprocess.run(
                ["icacls", *icacls_args],
                check=False,
                capture_output=True,
                text=True,
                timeout=10,
            )
            return res.returncode == 0
        except OSError:
            return False

    try:
        os.chmod(path_obj, 0o600)
        return True
    except OSError:
        return False


def _is_usable_env_secret(value: str | None) -> bool:
    if not value:
        return False
    stripped = value.strip()
    if len(stripped) < 16:
        return False
    lower = stripped.lower()
    return not any(lower.startswith(p) for p in _PLACEHOLDER_PREFIXES)


def get_runtime_secret(env_var: str) -> str:
    """
    Returns the configured secret from environment variables (loading backend/.env first),
    or generates and persists a per-installation CSPRNG secret in backend/.local_secrets.json (gitignored).
    Never uses hardcoded source-code secrets.
    """
    load_env_file()
    env_val = os.environ.get(env_var)
    if _is_usable_env_secret(env_val):
        return env_val.strip()

    store = {}
    if _SECRETS_FILE.is_file():
        try:
            store = json.loads(_SECRETS_FILE.read_text(encoding="utf-8"))
            if not isinstance(store, dict):
                store = {}
        except Exception:
            store = {}

    existing = store.get(env_var)
    if isinstance(existing, str) and len(existing) >= 32:
        return existing

    new_secret = secrets.token_urlsafe(48)
    store[env_var] = new_secret
    tmp_path = _SECRETS_FILE.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(store, indent=2), encoding="utf-8")
    os.replace(tmp_path, _SECRETS_FILE)
    harden_file_permissions(_SECRETS_FILE)
    return new_secret


def _normalize_aad(aad: bytes | str | None) -> bytes:
    if aad is None:
        return _DEFAULT_AAD
    if isinstance(aad, str):
        return aad.encode("utf-8")
    if isinstance(aad, (bytes, bytearray)):
        return bytes(aad)
    raise TypeError("aad must be bytes, str, or None")


def _derive_aes_key(master_secret: str, salt: bytes) -> bytes:
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"socialsync-aes-256-gcm-token-key",
    )
    return hkdf.derive(master_secret.encode("utf-8"))


def encrypt_token(plaintext: str | None, aad: bytes | str | None = None) -> str | None:
    """Encrypts a sensitive OAuth token using AES-256-GCM authenticated encryption."""
    if not plaintext:
        return None
    if plaintext.startswith(_PREFIX):
        return plaintext

    master_secret = get_runtime_secret("TOKEN_ENCRYPTION_KEY")
    salt = secrets.token_bytes(16)
    nonce = secrets.token_bytes(12)  # Standard 96-bit nonce for AES-GCM
    aes_key = _derive_aes_key(master_secret, salt)
    aad_bytes = _normalize_aad(aad)

    ciphertext = AESGCM(aes_key).encrypt(nonce, plaintext.encode("utf-8"), aad_bytes)
    payload = base64.urlsafe_b64encode(salt + nonce + ciphertext).decode("ascii")
    return f"{_PREFIX}{payload}"


def decrypt_token(token_value: str | None, aad: bytes | str | None = None) -> str | None:
    """Decrypts and verifies authenticity of an AES-256-GCM encrypted OAuth token."""
    if not token_value:
        return None
    if not token_value.startswith(_PREFIX):
        raise ValueError("Unencrypted or unsupported token format rejected.")

    encoded = token_value[len(_PREFIX):]
    try:
        raw_blob = base64.urlsafe_b64decode(encoded.encode("ascii"))
    except Exception as exc:
        raise ValueError("Corrupted encrypted token encoding.") from exc

    # Minimum: 16B salt + 12B nonce + 16B GCM auth tag = 44 bytes
    if len(raw_blob) < 44:
        raise ValueError("Corrupted encrypted token payload.")

    salt = raw_blob[:16]
    nonce = raw_blob[16:28]
    ciphertext = raw_blob[28:]

    master_secret = get_runtime_secret("TOKEN_ENCRYPTION_KEY")
    aes_key = _derive_aes_key(master_secret, salt)
    aad_bytes = _normalize_aad(aad)

    try:
        plaintext_bytes = AESGCM(aes_key).decrypt(nonce, ciphertext, aad_bytes)
    except Exception as exc:
        raise ValueError("AES-256-GCM token authentication failed (invalid key, AAD mismatch, or tampered ciphertext).") from exc

    return plaintext_bytes.decode("utf-8")


def redact_secrets(text: str | None, extra_values: list[str] | None = None) -> str:
    """Scrubs OAuth tokens, client secrets, and bearer headers from error/log strings."""
    if not text:
        return ""
    scrubbed = str(text)

    # Redact query/form sensitive parameters
    scrubbed = re.sub(
        r"(?i)(access_token|refresh_token|client_secret|fb_exchange_token|code|Authorization)\s*([=:])\s*([^\s&\"',;]+)",
        r"\1\2[REDACTED]",
        scrubbed,
    )
    scrubbed = re.sub(r"(?i)Bearer\s+[A-Za-z0-9._~+/=-]+", "Bearer [REDACTED]", scrubbed)

    secret_env_keys = (
        "SECRET_KEY",
        "TOKEN_ENCRYPTION_KEY",
        "META_APP_SECRET",
        "INSTAGRAM_APP_SECRET",
        "GOOGLE_CLIENT_SECRET",
    )
    candidates = list(extra_values or [])
    for k in secret_env_keys:
        val = os.environ.get(k)
        if val and not any(val.lower().startswith(p) for p in _PLACEHOLDER_PREFIXES):
            candidates.append(val)

    for secret in candidates:
        if secret and len(secret) >= 6 and secret in scrubbed:
            scrubbed = scrubbed.replace(secret, "[REDACTED]")
    return scrubbed
