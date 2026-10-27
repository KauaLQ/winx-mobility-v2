"""Matching: escolhe o veículo disponível mais próximo (menor tempo de rota) para um pedido."""
import networkx as nx

from fleet import CLOCK, FLEET, TRIPS, TransportRequest, Trip, TripPhase, VehicleStatus
from graph_model import FACTORY_GRAPH as G
from graph_model import find_route


def dispatch(req: TransportRequest) -> Trip:
    """Levanta ValueError (pedido inválido/impossível) ou LookupError (sem veículo agora)."""
    for node in (req.origin_node, req.destination_node):
        if node not in G:
            raise ValueError(f"Nó {node} não existe")

    # 1) o modal consegue ir da origem ao destino? (vale para qualquer veículo desse modal)
    try:
        ride = find_route(G, req.origin_node, req.destination_node, req.modal)
    except nx.NetworkXNoPath:
        raise ValueError(f"O modal '{req.modal.value}' não tem rota da origem ao destino")

    # 2) candidatos: disponíveis, do modal pedido e autorizados para esse tipo de pedido
    candidates = [
        v for v in FLEET.values()
        if v.status == VehicleStatus.DISPONIVEL
        and v.type == req.modal
        and req.kind in v.allowed_kinds
    ]

    # 3) o mais próximo = menor tempo de rota (com o tráfego de agora) até a origem
    best = None
    for v in candidates:
        try:
            pickup = find_route(G, v.current_node, req.origin_node, v.type)
        except nx.NetworkXNoPath:
            continue
        if best is None or pickup["estimated_time_s"] < best[1]["estimated_time_s"]:
            best = (v, pickup)
    if best is None:
        raise LookupError(
            f"Nenhum veículo '{req.modal.value}' disponível para '{req.kind.value}' no momento"
        )

    vehicle, pickup = best
    trip = Trip(
        id=f"trip-{len(TRIPS) + 1}",
        request=req,
        vehicle_id=vehicle.id,
        phase=TripPhase.BUSCANDO,
        eta_pickup_s=pickup["estimated_time_s"],
        eta_total_s=round(pickup["estimated_time_s"] + ride["estimated_time_s"], 1),
        created_at_s=CLOCK["s"],
    )
    TRIPS[trip.id] = trip

    vehicle.status = VehicleStatus.EM_CORRIDA
    vehicle.trip_id = trip.id
    vehicle.route = pickup["nodes"]
    vehicle.edge_remaining_s = None
    return trip