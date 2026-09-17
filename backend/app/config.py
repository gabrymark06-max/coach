"""Configurazione da env. Nessun segreto letterale: tutto passa da qui."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["dev", "test", "prod"] = "dev"
    app_name: str = "fitcoach"
    support_email: str = "supporto@fitcoach.example"
    frontend_url: str = "http://localhost:3000"
    # NoDecode: come variabile d'ambiente vera (Render, Railway) è "https://a,https://b", non JSON. Senza questo
    # pydantic-settings prova json.loads prima del validatore e il processo non parte (emerso nella prova di deploy).
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["http://localhost:3000"])
    # Il fuso in cui si decide "oggi" (piano, sedute, costanza, job) e il reset della quota chat.
    # TIMEZONE è il nome; QUOTA_TIMEZONE resta accettato per i .env già scritti.
    timezone: str = Field(default="Europe/Rome", validation_alias=AliasChoices("TIMEZONE", "QUOTA_TIMEZONE"))

    # Database. Vuoto in dev/test => Postgres embedded (pgserver) avviato dal processo.
    database_url: str = ""
    embedded_pg_dir: str = ".pgdata"

    # Auth
    jwt_secret: str = "dev-only-change-me-in-prod-0123456789abcdef"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    refresh_token_days: int = 30

    # Rate limiting (in-process: regge con 1 worker / 1 replica)
    rate_limit_default: str = "120/minute"
    rate_limit_auth: str = "10/minute"
    rate_limit_chat: str = "20/minute"
    rate_limit_enabled: bool = True

    # LLM
    llm_provider: Literal["fake", "anthropic", "openai"] = "fake"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"
    anthropic_model_tone: str = "claude-sonnet-5"
    openai_api_key: str = ""
    openai_base_url: str = "https://eu.api.openai.com/v1"
    openai_model: str = "gpt-5.4-mini"
    openai_model_tone: str = "gpt-5.4"
    embedding_provider: Literal["fake", "openai"] = "fake"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536  # <= 2000: indicizzabile con HNSW su `vector`

    # Quote chat
    chat_quota_free_month: int = 15
    chat_quota_pro_month: int = 300
    chat_quota_pro_day: int = 40

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_month: str = ""
    stripe_price_year: str = ""
    stripe_price_year_founders: str = ""
    stripe_founders_promo_code_id: str = ""  # promo_... con 100 utilizzi (business-model §5)
    stripe_founders_max: int = 100
    # Importi Pro in centesimi, IVA inclusa (business-model §5). Devono coincidere con i Price su Stripe:
    # l'API li espone in /billing/prices, il frontend non li tiene come costanti.
    pro_price_month_cents: int = 999
    pro_price_year_cents: int = 5999
    pro_price_year_founders_cents: int = 4999
    grace_days: int = 7
    withdrawal_days: int = 14

    # Email
    email_provider: Literal["fake", "resend"] = "fake"
    resend_api_key: str = ""
    email_from: str = "fitcoach <coach@fitcoach.example>"

    # Crossref polite pool
    crossref_mailto: str = ""

    # Job email mancata seduta
    missed_session_job_enabled: bool = True
    missed_session_job_interval_s: int = 3600
    missed_session_after_hours: int = 24

    # Storico free
    free_history_weeks: int = 8

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_prod(self) -> bool:
        return self.app_env == "prod"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_prod:
        if not s.database_url:
            raise RuntimeError("DATABASE_URL obbligatoria in produzione")
        if s.jwt_secret.startswith("dev-only"):
            raise RuntimeError("JWT_SECRET di sviluppo non ammesso in produzione")
    return s
