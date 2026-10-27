import networkx as nx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from graph_model import FACTORY_GRAPH, VehicleType, congestion_factor, find_route

router = APIRouter()


# ---------- Schemas ----------

class RouteResponse(BaseModel):
    nodes: list[int]
    distance_m: float
    estimated_time_s: float
    estimated_time_min: float


class NodeOut(BaseModel):
    id: int
    name: str
    x: float
    y: float


class EdgeOut(BaseModel):
    source: int
    target: int
    length_m: float
    max_speed_kmh: float
    max_height_m: float | None
    max_weight_t: float | None
    forbidden_vehicles: list[str]
    oneway: bool
    capacity: int
    load: int                  # veículos na via agora
    congestion_factor: float   # 1.0 = livre; multiplica o tempo de travessia


class GraphResponse(BaseModel):
    nodes: list[NodeOut]
    edges: list[EdgeOut]  # direcionadas: rua de mão dupla aparece 2x


# ---------- Endpoints ----------

@router.get("/route", response_model=RouteResponse)
def get_route(origin_node: int, destination_node: int, vehicle_type: VehicleType):
    for node in (origin_node, destination_node):
        if node not in FACTORY_GRAPH:
            raise HTTPException(404, f"Nó {node} não existe")

    try:
        result = find_route(FACTORY_GRAPH, origin_node, destination_node, vehicle_type)
    except nx.NetworkXNoPath:
        raise HTTPException(404, f"Sem rota possível para '{vehicle_type.value}'")

    return RouteResponse(**result, estimated_time_min=round(result["estimated_time_s"] / 60, 2))


@router.get("/map/graph", response_model=GraphResponse)
def get_graph():
    nodes = [NodeOut(id=n, **d) for n, d in FACTORY_GRAPH.nodes(data=True)]
    edges = [
        EdgeOut(
            source=u,
            target=v,
            length_m=d["length_m"],
            max_speed_kmh=d["max_speed_kmh"],
            max_height_m=d["max_height_m"],
            max_weight_t=d["max_weight_t"],
            forbidden_vehicles=sorted(d["forbidden"]),
            oneway=d["oneway"],
            capacity=d["capacity"],
            load=d["load"],
            congestion_factor=round(congestion_factor(d), 2),
        )
        for u, v, d in FACTORY_GRAPH.edges(data=True)
    ]
    return GraphResponse(nodes=nodes, edges=edges)