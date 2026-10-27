"""Modelo do grafo da planta: nós = cruzamentos/pontos de parada, arestas = ruas."""
from dataclasses import dataclass
from enum import Enum
from math import hypot

import networkx as nx


class VehicleType(str, Enum):
    CARRO = "carro"
    VAN = "van"
    ONIBUS = "onibus"
    CAMINHAO = "caminhao"


@dataclass(frozen=True)
class VehicleProfile:
    height_m: float
    weight_t: float
    max_speed_kmh: float


VEHICLES = {
    VehicleType.CARRO: VehicleProfile(height_m=1.6, weight_t=2.0, max_speed_kmh=40),
    VehicleType.VAN: VehicleProfile(height_m=2.4, weight_t=3.5, max_speed_kmh=35),
    VehicleType.ONIBUS: VehicleProfile(height_m=3.3, weight_t=12.0, max_speed_kmh=30),
    VehicleType.CAMINHAO: VehicleProfile(height_m=4.0, weight_t=20.0, max_speed_kmh=25),
}

# Congestionamento (estilo BPR): fator = 1 + ALPHA * (veículos na via / capacidade) ** BETA
CONGESTION_ALPHA = 1.0
CONGESTION_BETA = 2.0


# ---------- Construção do grafo ----------

def add_street(
    g: nx.DiGraph,
    u: int,
    v: int,
    *,
    oneway: bool = False,
    max_speed_kmh: float = 30.0,
    max_height_m: float | None = None,
    max_weight_t: float | None = None,
    forbidden: list[str] | None = None,
    capacity: int = 2,
) -> None:
    """Cria a rua u -> v (e v -> u, se não for mão única) com suas restrições.

    `capacity` = quantos veículos cabem na via antes de o tempo de travessia dobrar.
    `load` = veículos trafegando agora (mantido pela simulação, um contador por sentido).
    """
    a, b = g.nodes[u], g.nodes[v]
    attrs = dict(
        length_m=round(hypot(a["x"] - b["x"], a["y"] - b["y"]), 1),
        max_speed_kmh=max_speed_kmh,
        max_height_m=max_height_m,
        max_weight_t=max_weight_t,
        forbidden=frozenset(forbidden or []),
        oneway=oneway,
        capacity=capacity,
        load=0,
    )
    g.add_edge(u, v, **attrs)
    if not oneway:
        g.add_edge(v, u, **attrs)


def build_factory_graph() -> nx.DiGraph:
    """Planta de exemplo. Substitua por carga de CSV/JSON/BD quando necessário."""
    g = nx.DiGraph()
    nodes = [
        (1, "Portaria", 0, 0),
        (2, "Estacionamento", 0, 100),
        (3, "Cruzamento Central", 100, 50),
        (4, "Almoxarifado", 200, 0),
        (5, "Expedição", 300, 0),
        (6, "Produção", 200, 150),
        (7, "Refeitório", 100, 150),
        (8, "Doca de Cargas", 300, 150),
    ]
    for node_id, name, x, y in nodes:
        g.add_node(node_id, name=name, x=x, y=y)

    add_street(g, 1, 2)
    add_street(g, 1, 3)
    add_street(g, 2, 3, forbidden=["caminhao"])      # área de pedestres
    add_street(g, 3, 4, max_height_m=3.5)            # pórtico baixo
    add_street(g, 3, 7)
    add_street(g, 3, 6, oneway=True)                 # só sentido 3 -> 6
    add_street(g, 7, 6)
    add_street(g, 4, 5)
    add_street(g, 4, 6, max_weight_t=15, capacity=1)  # piso com limite de carga, via estreita
    add_street(g, 5, 8)
    add_street(g, 6, 8)
    return g


FACTORY_GRAPH = build_factory_graph()


# ---------- Regras de restrição e custo ----------

def is_allowed(edge: dict, vehicle_type: VehicleType) -> bool:
    v = VEHICLES[vehicle_type]
    if vehicle_type.value in edge["forbidden"]:
        return False
    if edge["max_height_m"] is not None and v.height_m > edge["max_height_m"]:
        return False
    if edge["max_weight_t"] is not None and v.weight_t > edge["max_weight_t"]:
        return False
    return True


def congestion_factor(edge: dict) -> float:
    """1.0 com a via livre; cresce conforme a carga se aproxima (e passa) da capacidade."""
    return 1.0 + CONGESTION_ALPHA * (edge["load"] / edge["capacity"]) ** CONGESTION_BETA


def travel_time_s(edge: dict, vehicle_type: VehicleType) -> float:
    """Tempo de travessia hoje = tempo em fluxo livre x fator de congestionamento."""
    speed_kmh = min(edge["max_speed_kmh"], VEHICLES[vehicle_type].max_speed_kmh)
    return edge["length_m"] / (speed_kmh / 3.6) * congestion_factor(edge)


def route_cost_s(g: nx.DiGraph, route: list[int], vehicle_type: VehicleType) -> float:
    return sum(travel_time_s(g[u][v], vehicle_type) for u, v in zip(route, route[1:]))


# ---------- Roteamento ----------

def find_route(g: nx.DiGraph, origin: int, destination: int, vehicle_type: VehicleType) -> dict:
    """Menor tempo de viagem considerando o congestionamento atual.

    Arestas proibidas retornam None no peso e o Dijkstra as ignora.
    Levanta nx.NetworkXNoPath se não houver caminho para o veículo.
    """
    def weight(u, v, edge):
        return travel_time_s(edge, vehicle_type) if is_allowed(edge, vehicle_type) else None

    path = nx.shortest_path(g, origin, destination, weight=weight, method="dijkstra")

    legs = [g[u][v] for u, v in zip(path, path[1:])]
    return {
        "nodes": path,
        "distance_m": round(sum(e["length_m"] for e in legs), 1),
        "estimated_time_s": round(sum(travel_time_s(e, vehicle_type) for e in legs), 1),
    }