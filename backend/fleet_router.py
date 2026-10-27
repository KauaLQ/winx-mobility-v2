"""Endpoints de frota, despacho e simulação.

Os endpoints que alteram estado são `async def` de propósito: sem `await` dentro deles,
cada chamada roda inteira no event loop, sem disputar o estado com o loop de simulação
(dispensa locks no MVP).
"""
from fastapi import APIRouter, HTTPException, Query

import simulation
from dispatch import dispatch
from fleet import (
    CLOCK, FLEET, TRIPS, SimulationState, TickResult, TransportRequest, Trip,
    Vehicle, VehicleCreate, add_vehicle, reset_world,
)
from graph_model import FACTORY_GRAPH

router = APIRouter()


def _snapshot() -> SimulationState:
    return SimulationState(
        clock_s=CLOCK["s"],
        running=simulation.is_running(),
        vehicles=list(FLEET.values()),
        trips=list(TRIPS.values()),
    )


# ---------- Frota ----------

@router.post("/vehicles", response_model=Vehicle, status_code=201)
async def create_vehicle(body: VehicleCreate):
    if body.id in FLEET:
        raise HTTPException(409, f"Veículo '{body.id}' já existe")
    if body.current_node not in FACTORY_GRAPH:
        raise HTTPException(404, f"Nó {body.current_node} não existe")
    return add_vehicle(body)


@router.get("/vehicles", response_model=list[Vehicle])
async def list_vehicles():
    return list(FLEET.values())


# ---------- Despacho ----------

@router.post("/dispatch", response_model=Trip, status_code=201)
async def post_dispatch(body: TransportRequest):
    try:
        return dispatch(body)
    except ValueError as e:      # pedido inválido ou impossível para o modal
        raise HTTPException(422, str(e))
    except LookupError as e:     # nenhum veículo elegível livre agora
        raise HTTPException(409, str(e))


@router.get("/trips", response_model=list[Trip])
async def list_trips():
    return list(TRIPS.values())


# ---------- Simulação ----------

@router.post("/simulation/tick", response_model=TickResult)
async def sim_tick(dt_s: float = Query(10.0, gt=0, le=600, description="segundos simulados")):
    return simulation.tick(dt_s)


@router.post("/simulation/start")
async def sim_start(
    interval_s: float = Query(1.0, gt=0, description="segundos reais entre ticks"),
    dt_s: float = Query(5.0, gt=0, le=600, description="segundos simulados por tick"),
):
    if not simulation.start_loop(interval_s, dt_s):
        raise HTTPException(409, "A simulação já está rodando")
    return {"running": True, "interval_s": interval_s, "dt_s": dt_s}


@router.post("/simulation/stop")
async def sim_stop():
    simulation.stop_loop()
    return {"running": False}


@router.get("/simulation/state", response_model=SimulationState)
async def sim_state():
    return _snapshot()


@router.post("/simulation/reset", response_model=SimulationState)
async def sim_reset():
    simulation.stop_loop()
    reset_world()
    return _snapshot()