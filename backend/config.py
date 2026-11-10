from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    """Variáveis de ambiente num lugar só. Em produção (Render) defina-as no painel;
    em desenvolvimento, use o arquivo backend/.env."""

    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    DB_URL: str
    SUPABASE_URL: str                 # de onde o backend baixa as chaves públicas para validar o token do Google

    JWT_SECRET: str                   # assina o token do gestor (login por credenciais)
    GESTOR_EMAIL: str
    GESTOR_SENHA: str
    GESTOR_TOKEN_HORAS: int = 12

    SEED_FROTA_DEMO: bool = False
    CORS_ORIGINS: List[str] = ["*"]   # em produção, restrinja ao domínio da Vercel
    ENVIRONMENT: str = "development"


settings = Settings()