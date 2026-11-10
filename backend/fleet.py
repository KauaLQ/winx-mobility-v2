"""Modelos e estado em memória da simulação. A persistência fica em persistencia.py."""
import re
from enum import Enum
from typing import Annotated, Optional

from pydantic import BaseModel, Field, StringConstraints, field_validator

from graph_model import VehicleType

BASE_NODE = 1  # Portaria: onde veículos novos aparecem e para onde voltam no reset


class VehicleStatus(str, Enum):
    DISPONIVEL = "disponivel"
    EM_CORRIDA = "em_corrida"


class RequestKind(str, Enum):
    PASSAGEIRO = "passageiro"
    INSUMO = "insumo"


class TripPhase(str, Enum):
    AGUARDANDO = "aguardando"        # pedido feito, esperando um motorista aceitar
    BUSCANDO = "buscando"            # indo até a origem do pedido
    EM_TRANSPORTE = "em_transporte"  # origem -> destino
    CONCLUIDA = "concluida"
    CANCELADA = "cancelada"          # o solicitante desistiu antes de alguém aceitar


# Restrição de carga por padrão: o que cada modal pode transportar.
DEFAULT_ALLOWED_KINDS = {
    VehicleType.CARRO: [RequestKind.PASSAGEIRO],
    VehicleType.VAN: [RequestKind.PASSAGEIRO, RequestKind.INSUMO],
    VehicleType.ONIBUS: [RequestKind.PASSAGEIRO],
    VehicleType.CAMINHAO: [RequestKind.INSUMO],
}

_PLATE_RE = re.compile(r"^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$")  # ABC1234 (antiga) e ABC1D23 (Mercosul)
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]


def _normalize_plate(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    plate = re.sub(r"[\s-]", "", value).upper()
    if not _PLATE_RE.match(plate):
        raise ValueError("Placa inválida. Use o formato ABC1D23 ou ABC-1234")
    return plate


# ---------- Schemas ----------

class VehicleCreate(BaseModel):
    name: Name                  # nome/modelo
    plate: str
    type: VehicleType

    _plate = field_validator("plate")(_normalize_plate)


class VehicleUpdate(BaseModel):
    name: Optional[Name] = None
    plate: Optional[str] = None
    type: Optional[VehicleType] = None
    active: Optional[bool] = None

    _plate = field_validator("plate")(_normalize_plate)


class Vehicle(BaseModel):
    id: int                    # id do banco
    name: str
    plate: str
    type: VehicleType
    current_node: int          # último nó pelo qual passou (em trânsito, é a origem da via atual)
    allowed_kinds: list[RequestKind]
    driver_id: int | None = None      # motorista vinculado (None = veículo livre para escolher)
    driver_name: str | None = None
    status: VehicleStatus = VehicleStatus.DISPONIVEL
    # --- estado da simulação (somente leitura) ---
    trip_id: int | None = None
    route: list[int] = []      # nós restantes da fase atual; route[0] == current_node
    edge_remaining_s: float | None = None  # tempo que falta para terminar a via atual
    edge_total_s: float = 0.0
    x: float = 0.0
    y: float = 0.0


class TransportRequest(BaseModel):
    kind: RequestKind
    origin_node: int
    destination_node: int
    modal: VehicleType         # modal necessário
    requested_by: int | None = None  # id do usuário; o backend sempre sobrescreve com o usuário autenticado


class Trip(BaseModel):
    id: int                    # id da corrida no banco (0 só entre o despacho e o INSERT)
    request: TransportRequest
    phase: TripPhase
    # Enquanto AGUARDANDO: estimativas só do trajeto origem -> destino (eta_pickup_s = 0).
    # Ao ser aceita, passam a incluir o deslocamento até a origem.
    eta_pickup_s: float
    eta_total_s: float
    distance_m: float
    created_at_s: float
    vehicle_id: int | None = None      # None até um motorista aceitar
    vehicle_name: str | None = None
    driver_id: int | None = None       # motorista que aceitou (é a ele que a avaliação fica ligada)
    offers: dict[int, float] = {}      # veículos que receberam o pedido -> tempo até a origem (s)
    completed_at_s: float | None = None
    reroutes: int = 0
    rating: int | None = None      # avaliação opcional do solicitante (1 a 5)
    comment: str | None = None


class TripReview(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=280)


class TickResult(BaseModel):
    clock_s: float
    active_vehicles: int
    events: list[str]


class SimulationState(BaseModel):
    clock_s: float
    running: bool
    vehicles: list[Vehicle]
    trips: list[Trip]


# ---------- Estado em memória (carregado do banco por persistencia.carregar_estado) ----------

FLEET: dict[int, Vehicle] = {}
TRIPS: dict[int, Trip] = {}
CLOCK = {"s": 0.0}  # relógio simulado, em segundos