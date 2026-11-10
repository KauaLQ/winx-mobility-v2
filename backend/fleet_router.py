"""Endpoints de despacho e simulação.

Os que alteram estado são `async def` de propósito: sem `await` entre ler e alterar a memória,
cada chamada roda inteira no event loop, sem disputar o estado com o loop de simulação
(dispensa locks no MVP). As consultas ao banco são síncronas e curtas.
O CRUD de veículos fica em routers/vehicles.py.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

import persistencia
import simulation
from auth import exigir_gestor, exigir_token, obter_motorista_atual, obter_usuario_atual
from database import obter_sessao
from dispatch import accept, cancel, dispatch, review
from fleet import CLOCK, FLEET, TRIPS, SimulationState, TickResult, TransportRequest, Trip, TripReview
from models import Motorista, Usuario, Veiculo

router = APIRouter()


def _snapshot() -> SimulationState:
    return SimulationState(
        clock_s=CLOCK["s"],
        running=simulation.is_running(),
        vehicles=list(FLEET.values()),
        trips=list(TRIPS.values()),
    )


def _viagem(trip_id: int) -> Trip:
    if trip_id not in TRIPS:
        raise HTTPException(404, f"Viagem '{trip_id}' não existe")
    return TRIPS[trip_id]


# ---------- Despacho ----------

@router.post("/dispatch", response_model=Trip, status_code=201)
async def post_dispatch(
    body: TransportRequest,
    usuario: Usuario = Depends(obter_usuario_atual),
    sessao: Session = Depends(obter_sessao),
):
    body.requested_by = usuario.id  # sempre o usuário autenticado
    try:
        trip = dispatch(body)
    except ValueError as e:      # pedido inválido ou impossível para o modal
        raise HTTPException(422, str(e))
    except LookupError as e:     # nenhum veículo elegível livre agora
        raise HTTPException(409, str(e))
    trip.id = persistencia.criar_corrida(sessao, trip)
    TRIPS[trip.id] = trip
    return trip


@router.post("/trips/{trip_id}/accept", response_model=Trip)
async def post_accept(
    trip_id: int,
    motorista: Motorista = Depends(obter_motorista_atual),
    sessao: Session = Depends(obter_sessao),
):
    _viagem(trip_id)
    # O veículo é o que o motorista tem vinculado: não dá para aceitar em nome de outro
    vehicle_id = sessao.exec(select(Veiculo.id).where(Veiculo.motorista_id == motorista.id)).first()
    if vehicle_id is None or vehicle_id not in FLEET:
        raise HTTPException(409, "Escolha um veículo antes de aceitar corridas")
    try:
        trip = accept(trip_id, vehicle_id, motorista.id)
    except LookupError as e:     # outro veículo foi mais rápido, ou a corrida foi cancelada
        raise HTTPException(409, str(e))
    persistencia.salvar_corrida(sessao, trip)
    return trip


@router.post("/trips/{trip_id}/cancel", response_model=Trip)
async def post_cancel(
    trip_id: int,
    usuario: Usuario = Depends(obter_usuario_atual),
    sessao: Session = Depends(obter_sessao),
):
    trip = _viagem(trip_id)
    if usuario.papel != "gestor" and trip.request.requested_by != usuario.id:
        raise HTTPException(403, "Só quem pediu a viagem pode cancelá-la")
    try:
        trip = cancel(trip_id)
    except LookupError as e:     # já foi aceita
        raise HTTPException(409, str(e))
    persistencia.salvar_corrida(sessao, trip)
    return trip


@router.post("/trips/{trip_id}/review", response_model=Trip)
async def post_review(
    trip_id: int,
    body: TripReview,
    usuario: Usuario = Depends(obter_usuario_atual),
    sessao: Session = Depends(obter_sessao),
):
    trip = _viagem(trip_id)
    if trip.request.requested_by != usuario.id:
        raise HTTPException(403, "Só quem pediu a viagem pode avaliá-la")
    try:
        review(trip_id, body.rating, body.comment)
    except LookupError as e:     # viagem não concluída ou já avaliada
        raise HTTPException(409, str(e))
    try:
        persistencia.criar_avaliacao(sessao, trip, body.rating, body.comment)
    except Exception:
        sessao.rollback()
        trip.rating, trip.comment = None, None  # desfaz a memória se o banco recusou
        raise
    return trip


@router.get("/trips", response_model=list[Trip])
async def list_trips(_: dict = Depends(exigir_token)):
    return list(TRIPS.values())


# ---------- Simulação ----------

@router.post("/simulation/tick", response_model=TickResult)
async def sim_tick(
    dt_s: float = Query(10.0, gt=0, le=600, description="segundos simulados"),
    _: Usuario = Depends(exigir_gestor),
):
    result = simulation.tick(dt_s)
    await simulation.persistir_mudancas()
    return result


@router.post("/simulation/start")
async def sim_start(
    interval_s: float = Query(1.0, gt=0, description="segundos reais entre ticks"),
    dt_s: float = Query(5.0, gt=0, le=600, description="segundos simulados por tick"),
    _: Usuario = Depends(exigir_gestor),
):
    if not simulation.start_loop(interval_s, dt_s):
        raise HTTPException(409, "A simulação já está rodando")
    return {"running": True, "interval_s": interval_s, "dt_s": dt_s}


@router.post("/simulation/stop")
async def sim_stop(_: Usuario = Depends(exigir_gestor)):
    simulation.stop_loop()
    return {"running": False}


@router.get("/simulation/state", response_model=SimulationState)
async def sim_state(_: dict = Depends(exigir_token)):  # polling a cada 500 ms: só valida o token, sem ir ao banco
    return _snapshot()


@router.post("/simulation/reset", response_model=SimulationState)
async def sim_reset(_: Usuario = Depends(exigir_gestor)):
    """Veículos voltam à Portaria, tráfego zera e corridas abertas são canceladas. O histórico fica no banco."""
    simulation.stop_loop()
    persistencia.carregar_estado(voltar_a_base=True)
    return _snapshot()