"""Simulação: move veículos pelas rotas, mantém a carga das vias e recalcula rotas."""
import asyncio
import logging

from fleet import CLOCK, FLEET, TRIPS, TickResult, Trip, TripPhase, Vehicle, VehicleStatus
from graph_model import FACTORY_GRAPH as G
from graph_model import congestion_factor, find_route, route_cost_s, travel_time_s

REROUTE_THRESHOLD = 1.5  # fator de congestionamento (em alguma via da rota) que dispara o recálculo


# ---------- Movimento ----------

def _enter_edge(v: Vehicle) -> None:
    edge = G[v.route[0]][v.route[1]]
    # o tempo é fixado na entrada, com o tráfego de quem já está na via
    v.edge_remaining_s = v.edge_total_s = travel_time_s(edge, v.type)
    edge["load"] += 1


def _leave_edge(v: Vehicle) -> None:
    G[v.route[0]][v.route[1]]["load"] -= 1
    v.current_node = v.route[1]
    v.route.pop(0)
    v.edge_remaining_s = None


def _maybe_reroute(v: Vehicle, trip: Trip, events: list[str]) -> None:
    """Chamado num nó, antes de entrar na próxima via."""
    legs = zip(v.route, v.route[1:])
    if max(congestion_factor(G[a][b]) for a, b in legs) < REROUTE_THRESHOLD:
        return
    new = find_route(G, v.current_node, v.route[-1], v.type)
    if new["nodes"] != v.route and new["estimated_time_s"] < round(route_cost_s(G, v.route, v.type), 1):
        v.route = new["nodes"]
        trip.reroutes += 1
        events.append(f"{v.id}: rota recalculada por congestionamento -> {new['nodes']}")


def _finish_phase(v: Vehicle, trip: Trip, now: float, events: list[str]) -> bool:
    """Fim da rota da fase atual. Retorna False quando a viagem termina."""
    if trip.phase == TripPhase.BUSCANDO:
        trip.phase = TripPhase.EM_TRANSPORTE
        v.route = find_route(G, v.current_node, trip.request.destination_node, v.type)["nodes"]
        events.append(f"{v.id}: chegou à origem (nó {v.current_node}), iniciando transporte")
        return True

    trip.phase = TripPhase.CONCLUIDA
    trip.completed_at_s = round(now, 1)
    v.status = VehicleStatus.DISPONIVEL
    v.trip_id = None
    v.route = []
    events.append(f"{v.id}: viagem {trip.id} concluída no nó {v.current_node}")
    return False


def _update_position(v: Vehicle) -> None:
    a = G.nodes[v.current_node]
    if v.edge_remaining_s is None or len(v.route) < 2 or not v.edge_total_s:
        v.x, v.y = a["x"], a["y"]
        return
    b = G.nodes[v.route[1]]
    p = 1 - v.edge_remaining_s / v.edge_total_s
    v.x = round(a["x"] + (b["x"] - a["x"]) * p, 1)
    v.y = round(a["y"] + (b["y"] - a["y"]) * p, 1)


def _advance(v: Vehicle, dt_s: float, events: list[str]) -> None:
    trip = TRIPS[v.trip_id]
    budget = dt_s
    while True:
        if v.edge_remaining_s is not None:           # em trânsito numa via
            used = min(budget, v.edge_remaining_s)
            v.edge_remaining_s -= used
            budget -= used
            if v.edge_remaining_s > 1e-9:
                break                                # o tempo do tick acabou no meio da via
            _leave_edge(v)

        if len(v.route) < 2:                         # chegou ao fim da fase
            if not _finish_phase(v, trip, CLOCK["s"] + dt_s - budget, events):
                break                                # viagem concluída
            continue

        if budget <= 1e-9:
            break
        _maybe_reroute(v, trip, events)
        _enter_edge(v)
    _update_position(v)


def tick(dt_s: float) -> TickResult:
    """Avança a simulação em dt_s segundos simulados."""
    events: list[str] = []
    for v in [v for v in FLEET.values() if v.status == VehicleStatus.EM_CORRIDA]:
        _advance(v, dt_s, events)
    CLOCK["s"] = round(CLOCK["s"] + dt_s, 3)
    active = sum(v.status == VehicleStatus.EM_CORRIDA for v in FLEET.values())
    return TickResult(clock_s=CLOCK["s"], active_vehicles=active, events=events)


# ---------- Loop em background ----------

_task: asyncio.Task | None = None


async def _loop(interval_s: float, dt_s: float) -> None:
    while True:
        try:
            tick(dt_s)
        except Exception:
            logging.exception("Falha no tick da simulação; loop interrompido")
            return
        await asyncio.sleep(interval_s)


def is_running() -> bool:
    return _task is not None and not _task.done()


def start_loop(interval_s: float, dt_s: float) -> bool:
    """Roda um tick de dt_s segundos simulados a cada interval_s segundos reais."""
    global _task
    if is_running():
        return False
    _task = asyncio.create_task(_loop(interval_s, dt_s))
    return True


def stop_loop() -> None:
    if is_running():
        _task.cancel()