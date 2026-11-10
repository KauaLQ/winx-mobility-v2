"""Tabelas do PostgreSQL. Enums ficam como str de propósito: alterar ENUM nativo do Postgres é doloroso."""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, Text
from sqlmodel import Field, SQLModel


def agora_utc() -> datetime:
    return datetime.now(timezone.utc)


def _coluna_data() -> Column:
    return Column(DateTime(timezone=True))


# ---------- Usuários (usuário final e gestor; o motorista é um usuário + registro em `motoristas`) ----------
class Usuario(SQLModel, table=True):
    __tablename__ = "usuarios"

    id: Optional[int] = Field(default=None, primary_key=True)
    nome: str
    email: str = Field(unique=True, index=True)
    supabase_id: Optional[str] = Field(default=None, unique=True, index=True)  # claim "sub" do login Google
    senha_hash: Optional[str] = Field(default=None)                            # só o gestor tem senha
    papel: str = Field(default="usuario", index=True)                          # usuario | gestor
    avatar_url: Optional[str] = Field(default=None)
    telefone: Optional[str] = Field(default=None)
    ativo: bool = Field(default=True)
    criado_em: datetime = Field(default_factory=agora_utc, sa_column=_coluna_data())
    atualizado_em: datetime = Field(default_factory=agora_utc, sa_column=_coluna_data())


# ---------- Motoristas ----------
class Motorista(SQLModel, table=True):
    __tablename__ = "motoristas"

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id", unique=True, index=True)
    telefone: Optional[str] = Field(default=None)
    cnh: Optional[str] = Field(default=None)  # evolução futura: validação de habilitação
    ativo: bool = Field(default=True)
    criado_em: datetime = Field(default_factory=agora_utc, sa_column=_coluna_data())
    atualizado_em: datetime = Field(default_factory=agora_utc, sa_column=_coluna_data())


# ---------- Veículos ----------
class Veiculo(SQLModel, table=True):
    __tablename__ = "veiculos"

    id: Optional[int] = Field(default=None, primary_key=True)
    nome: str                                         # nome/modelo
    placa: str = Field(unique=True, index=True)       # normalizada: ABC1D23
    tipo: str                                         # carro | van | onibus | caminhao
    ativo: bool = Field(default=True)
    no_atual: int = Field(default=1)                  # último nó conhecido (1 = Portaria)
    # GPS real (piloto na planta): hoje vazio, a posição vem da simulação
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    posicao_em: Optional[datetime] = Field(default=None, sa_column=_coluna_data())
    # UNIQUE: um motorista só pode ter um veículo, e um veículo só tem um motorista (NULLs não colidem)
    motorista_id: Optional[int] = Field(default=None, foreign_key="motoristas.id", unique=True)
    criado_em: datetime = Field(default_factory=agora_utc, sa_column=_coluna_data())
    atualizado_em: datetime = Field(default_factory=agora_utc, sa_column=_coluna_data())


# ---------- Corridas (histórico de viagens) ----------
class Corrida(SQLModel, table=True):
    __tablename__ = "corridas"

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id", index=True)             # quem pediu
    motorista_id: Optional[int] = Field(default=None, foreign_key="motoristas.id", index=True)
    veiculo_id: Optional[int] = Field(default=None, foreign_key="veiculos.id", index=True)

    tipo_carga: str                                   # passageiro | insumo
    modal: str                                        # carro | van | onibus | caminhao
    no_origem: int
    no_destino: int
    fase: str = Field(index=True)                     # aguardando | buscando | em_transporte | concluida | cancelada

    eta_busca_s: float = Field(default=0.0)
    eta_total_s: float = Field(default=0.0)
    distancia_m: float = Field(default=0.0)
    recalculos: int = Field(default=0)

    # Relógio da simulação (o front mostra "pedida às 02:10" e durações com ele)
    criada_sim_s: float = Field(default=0.0)
    concluida_sim_s: Optional[float] = Field(default=None)

    criada_em: datetime = Field(default_factory=agora_utc, sa_column=_coluna_data())
    aceita_em: Optional[datetime] = Field(default=None, sa_column=_coluna_data())
    iniciada_em: Optional[datetime] = Field(default=None, sa_column=_coluna_data())
    concluida_em: Optional[datetime] = Field(default=None, sa_column=_coluna_data())
    cancelada_em: Optional[datetime] = Field(default=None, sa_column=_coluna_data())

    # Evoluções futuras: GPS real e métricas ESG por corrida (hoje o painel calcula no front)
    origem_lat: Optional[float] = Field(default=None)
    origem_lng: Optional[float] = Field(default=None)
    destino_lat: Optional[float] = Field(default=None)
    destino_lng: Optional[float] = Field(default=None)
    consumo_litros: Optional[float] = Field(default=None)
    co2_kg: Optional[float] = Field(default=None)
    tempo_economizado_s: Optional[float] = Field(default=None)


# ---------- Avaliações (do usuário ao motorista/viagem) ----------
class Avaliacao(SQLModel, table=True):
    __tablename__ = "avaliacoes"

    id: Optional[int] = Field(default=None, primary_key=True)
    corrida_id: int = Field(foreign_key="corridas.id", unique=True)  # uma avaliação por corrida
    usuario_id: int = Field(foreign_key="usuarios.id", index=True)
    motorista_id: Optional[int] = Field(default=None, foreign_key="motoristas.id", index=True)
    veiculo_id: Optional[int] = Field(default=None, foreign_key="veiculos.id")
    nota: int                                         # 1 a 5
    comentario: Optional[str] = Field(default=None, sa_column=Column(Text))
    criado_em: datetime = Field(default_factory=agora_utc, sa_column=_coluna_data())
    atualizado_em: datetime = Field(default_factory=agora_utc, sa_column=_coluna_data())