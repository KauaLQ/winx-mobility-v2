from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

import models  # noqa: F401  (registra as tabelas no SQLModel antes do create_all)
from config import settings

def _url_do_banco(url: str) -> str:
    """O SQLAlchemy 2.1 assume o driver psycopg (v3) quando a URL não diz qual usar.
    Aqui fixamos o psycopg2, que é o instalado no requirements.txt."""
    for prefixo in ("postgres://", "postgresql://"):  # "postgres://" é como alguns painéis entregam a URL
        if url.startswith(prefixo):
            return "postgresql+psycopg2://" + url[len(prefixo):]
    return url


# pool_pre_ping evita "conexão caiu" em Postgres gerenciado (Supabase derruba conexões ociosas)
engine = create_engine(_url_do_banco(settings.DB_URL), pool_pre_ping=True)


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