"""backend/config.py — centralised, type-safe configuration (Session 6).

Replaces the scattered ``os.getenv()`` / module-level constants that used to
live at the top of ``main.py`` with a single validated ``Settings`` object
(pydantic-settings). Values / defaults are byte-for-byte identical to the
pre-refactor constants so behaviour is unchanged.
"""
from __future__ import annotations

import warnings
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo layout anchors (this file lives in ``backend/``).
_BACKEND_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _BACKEND_DIR.parent


class Settings(BaseSettings):
    """Application settings, populated from the environment / ``.env``.

    Defaults mirror the original hard-coded values in ``main.py`` exactly:
      - JWT_SECRET      -> "dev-secret-change-me"
      - ALGORITHM       -> "HS256"
      - token lifetime  -> 72 hours
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Auth / JWT ────────────────────────────────────────────
    jwt_secret: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_hours: int = 72

    @field_validator("jwt_secret")
    @classmethod
    def check_jwt_secret(cls, v: str) -> str:
        if v == "dev-secret-change-me":
            warnings.warn("JWT_SECRET is using the insecure development default!")
        return v

    # ── Storage paths ─────────────────────────────────────────
    db_path: Path = _PROJECT_ROOT / "medapp.db"
    upload_dir: Path = _PROJECT_ROOT / "uploads"

    # ── Frontend (SPA) static bundle ──────────────────────────
    static_dir: Path = _PROJECT_ROOT / "frontend" / "dist"

    # ── Ollama Local LLM Settings ─────────────────────────────
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "biomistral"
    ollama_fallback_model: str = "llama3.2:3b"
    ollama_keep_alive: int = 0

    # ── Chandra OCR Settings ──────────────────────────────────
    chandra_model_id: str = "datalab-to/chandra-ocr-2"
    chandra_max_megapixels: float = 1.0


# ``JWT_SECRET`` was read via os.getenv in the old code; pydantic-settings maps
# the ``jwt_secret`` field to the ``JWT_SECRET`` env var automatically (case
# insensitive), preserving the original override behaviour.
settings = Settings()

# Ensure the upload directory exists (matches the old ``UPLOAD_DIR.mkdir`` call).
settings.upload_dir.mkdir(parents=True, exist_ok=True)

