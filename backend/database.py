from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

import models  # noqa: F401  (registra as tabelas no SQLModel antes do create_all)
from config import settings

# pool_pre_ping evita "conexão caiu" em Postgres gerenciado (Supabase derruba conexões ociosas)
engine = create_engine(settings.DB_URL, pool_pre_ping=True)


def criar_tabelas() -> None:
    """Cria as tabelas que ainda não existem."""
    SQLModel.metadata.create_all(engine)


def aplicar_migracoes_simples() -> None:
    """Colunas novas em tabelas que já existem (sem Alembic). Cada comando precisa ser idempotente."""
    comandos = [
        # Exemplo: "ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS cor VARCHAR",
    ]
    with engine.begin() as conexao:
        for comando in comandos:
            conexao.execute(text(comando))


def obter_sessao():
    """Dependency do FastAPI: entrega uma Session e fecha no fim da requisição."""
    with Session(engine) as sessao:
        yield sessao


if __name__ == "__main__":
    # python database.py -> cria as tabelas manualmente
    criar_tabelas()
    aplicar_migracoes_simples()
    print("[DB] Tabelas criadas/verificadas com sucesso.")