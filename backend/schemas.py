"""Schemas da API (JSON em inglês, como o resto do contrato com o front)."""
from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, Field, StringConstraints

from models import Avaliacao, Corrida, Usuario

Nome = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
Texto20 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)]


# ---------- Auth / usuários ----------
class ManagerLogin(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str                  # usuario | gestor
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    active: bool


class UserUpdate(BaseModel):
    name: Optional[Nome] = None
    phone: Optional[Texto20] = None
    active: Optional[bool] = None  # só o gestor altera


def user_out(u: Usuario) -> UserOut:
    return UserOut(id=u.id, name=u.nome, email=u.email, role=u.papel, avatar_url=u.avatar_url, phone=u.telefone, active=u.ativo)


# ---------- Motoristas ----------
class DriverOut(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    phone: Optional[str] = None
    license: Optional[str] = None
    active: bool
    vehicle_id: Optional[int] = None   # veículo vinculado agora
    rating_avg: Optional[float] = None
    rating_count: int = 0


class DriverUpdate(BaseModel):
    phone: Optional[Texto20] = None
    license: Optional[Texto20] = None
    active: Optional[bool] = None      # só o gestor altera


# ---------- Corridas (histórico do banco) ----------
class TripHistoryOut(BaseModel):
    id: int
    user_id: int
    driver_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    kind: str
    modal: str
    origin_node: int
    destination_node: int
    status: str
    pickup_eta_s: float
    total_eta_s: float
    distance_m: float
    reroutes: int
    created_at: datetime
    accepted_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    fuel_liters: Optional[float] = None
    co2_kg: Optional[float] = None
    time_saved_s: Optional[float] = None


def trip_out(c: Corrida) -> TripHistoryOut:
    return TripHistoryOut(
        id=c.id, user_id=c.usuario_id, driver_id=c.motorista_id, vehicle_id=c.veiculo_id,
        kind=c.tipo_carga, modal=c.modal, origin_node=c.no_origem, destination_node=c.no_destino,
        status=c.fase, pickup_eta_s=c.eta_busca_s, total_eta_s=c.eta_total_s, distance_m=c.distancia_m,
        reroutes=c.recalculos, created_at=c.criada_em, accepted_at=c.aceita_em, started_at=c.iniciada_em,
        completed_at=c.concluida_em, cancelled_at=c.cancelada_em,
        fuel_liters=c.consumo_litros, co2_kg=c.co2_kg, time_saved_s=c.tempo_economizado_s,
    )


# ---------- Avaliações ----------
class ReviewOut(BaseModel):
    id: int
    trip_id: int
    user_id: int
    driver_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    rating: int
    comment: Optional[str] = None
    created_at: datetime


class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=280)


def review_out(a: Avaliacao) -> ReviewOut:
    return ReviewOut(
        id=a.id, trip_id=a.corrida_id, user_id=a.usuario_id, driver_id=a.motorista_id,
        vehicle_id=a.veiculo_id, rating=a.nota, comment=a.comentario, created_at=a.criado_em,
    )