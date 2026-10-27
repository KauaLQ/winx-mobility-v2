"""Modelos e estado em memória: frota, pedidos e viagens."""
from enum import Enum
from pydantic import BaseModel
from graph_model import FACTORY_GRAPH, VehicleType


class VehicleStatus(str, Enum):
    DISPONIVEL = "disponivel"
    EM_CORRIDA = "em_corrida"


class RequestKind(str, Enum):
    PASSAGEIRO = "passageiro"
    INSUMO = "insumo"


class TripPhase(str, Enum):
    BUSCANDO = "buscando"            # indo até a origem do pedido
    EM_TRANSPORTE = "em_transporte"  # origem -> destino
    CONCLUIDA = "concluida"


# Restrição de carga por padrão: o que cada modal pode transportar.
DEFAULT_ALLOWED_KINDS = {
    VehicleType.CARRO: [RequestKind.PASSAGEIRO],
    VehicleType.VAN: [RequestKind.PASSAGEIRO, RequestKind.INSUMO],
    VehicleType.ONIBUS: [RequestKind.PASSAGEIRO],
    VehicleType.CAMINHAO: [RequestKind.INSUMO],
}


# ---------- Schemas ----------

class VehicleCreate(BaseModel):
    id: str
    type: VehicleType
    current_node: int
    allowed_kinds: list[RequestKind] | None = None  # restrição; None = padrão do modal


class Vehicle(BaseModel):
    id: str
    type: VehicleType
    current_node: int          # último nó pelo qual passou (em trânsito, é a origem da via atual)
    allowed_kinds: list[RequestKind]
    status: VehicleStatus = VehicleStatus.DISPONIVEL
    # --- estado da simulação (somente leitura) ---
    trip_id: str | None = None
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


class Trip(BaseModel):
    id: str
    request: TransportRequest
    vehicle_id: str
    phase: TripPhase
    eta_pickup_s: float        # estimativas feitas no momento do despacho
    eta_total_s: float
    created_at_s: float
    completed_at_s: float | None = None
    reroutes: int = 0


class TickResult(BaseModel):
    clock_s: float
    active_vehicles: int
    events: list[str]


class SimulationState(BaseModel):
    clock_s: float
    running: bool
    vehicles: list[Vehicle]
    trips: list[Trip]


# ---------- Estado em memória ----------

FLEET: dict[str, Vehicle] = {}
TRIPS: dict[str, Trip] = {}
CLOCK = {"s": 0.0}  # relógio simulado, em segundos

SEED_FLEET = [
    ("carro-1", VehicleType.CARRO, 1),
    ("carro-2", VehicleType.CARRO, 1),
    ("carro-3", VehicleType.CARRO, 1),
    ("van-1", VehicleType.VAN, 3),
    ("onibus-1", VehicleType.ONIBUS, 2),
    ("caminhao-1", VehicleType.CAMINHAO, 8),
    ("caminhao-2", VehicleType.CAMINHAO, 6),
]


def add_vehicle(data: VehicleCreate) -> Vehicle:
    node = FACTORY_GRAPH.nodes[data.current_node]
    vehicle = Vehicle(
        id=data.id,
        type=data.type,
        current_node=data.current_node,
        allowed_kinds=data.allowed_kinds or list(DEFAULT_ALLOWED_KINDS[data.type]),
        x=node["x"],
        y=node["y"],
    )
    FLEET[vehicle.id] = vehicle
    return vehicle


def reset_world() -> None:
    """Zera relógio, viagens e tráfego e recria a frota de exemplo."""
    FLEET.clear()
    TRIPS.clear()
    CLOCK["s"] = 0.0
    for _, _, edge in FACTORY_GRAPH.edges(data=True):
        edge["load"] = 0
    for vid, vtype, node in SEED_FLEET:
        add_vehicle(VehicleCreate(id=vid, type=vtype, current_node=node))


reset_world()