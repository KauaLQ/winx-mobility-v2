"""Despacho em duas etapas: o pedido é oferecido aos veículos elegíveis e o primeiro a aceitar leva a corrida."""
import networkx as nx

from fleet import CLOCK, FLEET, TRIPS, TransportRequest, Trip, TripPhase, VehicleStatus
from graph_model import FACTORY_GRAPH as G
from graph_model import find_route

MAX_PICKUP_S = 180  # só recebem o pedido os veículos a até 3 min (com o tráfego de agora) da origem


def dispatch(req: TransportRequest) -> Trip:
    """Cria o pedido (AGUARDANDO) e o oferece aos veículos elegíveis.

    Levanta ValueError (pedido inválido/impossível) ou LookupError (nenhum veículo elegível agora).
    """
    for node in (req.origin_node, req.destination_node):
        if node not in G:
            raise ValueError(f"Nó {node} não existe")

    # 1) o modal consegue ir da origem ao destino? (vale para qualquer veículo desse modal)
    try:
        ride = find_route(G, req.origin_node, req.destination_node, req.modal)
    except nx.NetworkXNoPath:
        raise ValueError(f"O modal '{req.modal.value}' não tem rota da origem ao destino")

    # 2) elegíveis: disponíveis, do modal pedido, autorizados para esse tipo de pedido e próximos da origem
    offers: dict[str, float] = {}
    for v in FLEET.values():
        if v.status != VehicleStatus.DISPONIVEL or v.type != req.modal or req.kind not in v.allowed_kinds:
            continue
        try:
            pickup = find_route(G, v.current_node, req.origin_node, v.type)
        except nx.NetworkXNoPath:
            continue
        if pickup["estimated_time_s"] <= MAX_PICKUP_S:
            offers[v.id] = pickup["estimated_time_s"]
    if not offers:
        raise LookupError(
            f"Nenhum veículo '{req.modal.value}' disponível para '{req.kind.value}' no momento"
        )

    trip = Trip(
        id=f"trip-{len(TRIPS) + 1}",
        request=req,
        phase=TripPhase.AGUARDANDO,
        eta_pickup_s=0.0,
        eta_total_s=ride["estimated_time_s"],
        distance_m=ride["distance_m"],
        created_at_s=CLOCK["s"],
        offers=offers,
    )
    TRIPS[trip.id] = trip
    return trip


def accept(trip_id: str, vehicle_id: str) -> Trip:
    """O veículo aceita a corrida. Levanta LookupError se ela não está mais disponível para ele."""
    trip, vehicle = TRIPS[trip_id], FLEET[vehicle_id]
    if trip.phase != TripPhase.AGUARDANDO:
        raise LookupError("Essa corrida já foi aceita por outro veículo ou foi cancelada")
    if vehicle_id not in trip.offers or vehicle.status != VehicleStatus.DISPONIVEL:
        raise LookupError("Esse veículo não pode aceitar a corrida agora")

    try:
        pickup = find_route(G, vehicle.current_node, trip.request.origin_node, vehicle.type)
    except nx.NetworkXNoPath:
        raise LookupError("Sem rota até a origem da corrida")

    trip.vehicle_id = vehicle_id
    trip.phase = TripPhase.BUSCANDO
    trip.eta_pickup_s = pickup["estimated_time_s"]
    trip.eta_total_s = round(pickup["estimated_time_s"] + trip.eta_total_s, 1)
    trip.distance_m = round(pickup["distance_m"] + trip.distance_m, 1)

    vehicle.status = VehicleStatus.EM_CORRIDA
    vehicle.trip_id = trip.id
    vehicle.route = pickup["nodes"]
    vehicle.edge_remaining_s = None
    return trip


def cancel(trip_id: str) -> Trip:
    """Cancela um pedido que ninguém aceitou ainda. Levanta LookupError nos demais casos."""
    trip = TRIPS[trip_id]
    if trip.phase != TripPhase.AGUARDANDO:
        raise LookupError("Só é possível cancelar enquanto nenhum motorista aceitou")
    trip.phase = TripPhase.CANCELADA
    return trip


def review(trip_id: str, rating: int, comment: str | None) -> Trip:
    """Registra a avaliação de uma viagem concluída. Levanta LookupError se não for possível."""
    trip = TRIPS[trip_id]
    if trip.phase != TripPhase.CONCLUIDA:
        raise LookupError("Só é possível avaliar uma viagem concluída")
    if trip.rating is not None:
        raise LookupError("Essa viagem já foi avaliada")
    trip.rating = rating
    trip.comment = comment or None
    return trip
