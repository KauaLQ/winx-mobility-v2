"""Histórico de corridas direto do banco. O ciclo de vida (criar/aceitar/cancelar) fica em fleet_router.py,
porque é uma máquina de estados ligada à simulação; editar fase livremente quebraria a consistência."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlmodel import Session, col, select

from auth import exigir_gestor, obter_usuario_atual
from database import obter_sessao
from fleet import TRIPS
from models import Avaliacao, Corrida, Motorista, Usuario
from schemas import TripHistoryOut, trip_out

router = APIRouter(prefix="/trips", tags=["Corridas"])


def _motorista_do(sessao: Session, usuario: Usuario) -> Motorista | None:
    return sessao.exec(select(Motorista).where(Motorista.usuario_id == usuario.id)).first()


@router.get("/history", response_model=list[TripHistoryOut])
def trip_history(
    status: str | None = None,
    driver_id: int | None = None,
    user_id: int | None = None,
    limit: int = Query(100, ge=1, le=500),
    usuario: Usuario = Depends(obter_usuario_atual),
    sessao: Session = Depends(obter_sessao),
):
    """Gestão vê tudo (com filtros); usuário vê as que pediu; motorista, também as que conduziu."""
    consulta = select(Corrida).order_by(col(Corrida.id).desc()).limit(limit)
    if usuario.papel == "gestor":
        if status:
            consulta = consulta.where(Corrida.fase == status)
        if driver_id:
            consulta = consulta.where(Corrida.motorista_id == driver_id)
        if user_id:
            consulta = consulta.where(Corrida.usuario_id == user_id)
    else:
        motorista = _motorista_do(sessao, usuario)
        meus = [Corrida.usuario_id == usuario.id]
        if motorista:
            meus.append(Corrida.motorista_id == motorista.id)
        consulta = consulta.where(or_(*meus))
        if status:
            consulta = consulta.where(Corrida.fase == status)
    return [trip_out(c) for c in sessao.exec(consulta).all()]


@router.get("/{trip_id}", response_model=TripHistoryOut)
def get_trip(trip_id: int, usuario: Usuario = Depends(obter_usuario_atual), sessao: Session = Depends(obter_sessao)):
    corrida = sessao.get(Corrida, trip_id)
    if not corrida:
        raise HTTPException(404, "Corrida não encontrada")
    if usuario.papel != "gestor":
        motorista = _motorista_do(sessao, usuario)
        if corrida.usuario_id != usuario.id and not (motorista and corrida.motorista_id == motorista.id):
            raise HTTPException(404, "Corrida não encontrada")
    return trip_out(corrida)


@router.delete("/{trip_id}", status_code=204)
async def delete_trip(trip_id: int, _: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    """Remove uma corrida encerrada (e a avaliação dela). Corrida em andamento não pode ser apagada."""
    corrida = sessao.get(Corrida, trip_id)
    if not corrida:
        raise HTTPException(404, "Corrida não encontrada")
    if corrida.fase not in ("concluida", "cancelada"):
        raise HTTPException(409, "Só é possível excluir corridas concluídas ou canceladas")
    for aval in sessao.exec(select(Avaliacao).where(Avaliacao.corrida_id == trip_id)).all():
        sessao.delete(aval)
    sessao.delete(corrida)
    sessao.commit()
    TRIPS.pop(trip_id, None)