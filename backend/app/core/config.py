from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    qr_secret: str  # clé de chiffrement des QR Codes
    jwt_expire_minutes: int = 480
    timezone: str = "Indian/Antananarivo"

    admin_email: str = "admin@example.com"
    admin_password: str = ""  # si renseigné, l'admin est créé au démarrage

    cors_origins: str = "http://localhost:5173"  # séparées par des virgules
    max_upload_mb: int = 4
    payment_instructions: str = (
        "Effectuez votre paiement (MVola / Orange Money / Airtel Money) "
        "puis joignez la capture d'écran de la transaction."
    )

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "itsikaevent.mdg@gmail.com"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @field_validator("database_url")
    @classmethod
    def normalize_db_url(cls, v: str) -> str:
        # Render fournit "postgres://" ou "postgresql://" : on force le driver psycopg 3
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    @field_validator("jwt_secret", "qr_secret")
    @classmethod
    def secret_not_weak(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("Les secrets doivent contenir au moins 32 caractères")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
