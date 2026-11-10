"""Leitura/edição/remoção de avaliações. A criação é POST /trips/{id}/review (fleet_router.py)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, col, select

from auth import exigir_gestor, obter_usuario_atual
from database import obter_sessao
from fleet import TRIPS
from models import Avaliacao, Motorista, Usuario, agora_utc
from schemas import ReviewOut, ReviewUpdate, review_out

router = APIRouter(tags=["Avaliações"])


def _obter(sessao: Session, review_id: int) -> Avaliacao:
    aval = sessao.get(Avaliacao, review_id)
    if not aval:
        raise HTTPException(404, "Avaliação não encontrada")
    return aval


@router.get("/reviews", response_model=list[ReviewOut])
def list_reviews(driver_id: int | None = None, _: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    consulta = select(Avaliacao).order_by(col(Avaliacao.id).desc())
    if driver_id:
        consulta = consulta.where(Avaliacao.motorista_id == driver_id)
    return [review_out(a) for a in sessao.exec(consulta).all()]


@router.get("/drivers/{driver_id}/reviews", response_model=list[ReviewOut])
def driver_reviews(driver_id: int, usuario: Usuario = Depends(obter_usuario_atual), sessao: Session = Depends(obter_sessao)):
    """Gestão, ou o próprio motorista vendo as avaliações que recebeu."""
    if usuario.papel != "gestor":
        motorista = sessao.exec(select(Motorista).where(Motorista.usuario_id == usuario.id)).first()
        if not motorista or motorista.id != driver_id:
            raise HTTPException(403, "Acesso negado")
    consulta = select(Avaliacao).where(Avaliacao.motorista_id == driver_id).order_by(col(Avaliacao.id).desc())
    return [review_out(a) for a in sessao.exec(consulta).all()]


@router.put("/reviews/{review_id}", response_model=ReviewOut)
async def update_review(review_id: int, dados: ReviewUpdate, usuario: Usuario = Depends(obter_usuario_atual), sessao: Session = Depends(obter_sessao)):
    aval = _obter(sessao, review_id)
    if aval.usuario_id != usuario.id:
        raise HTTPException(403, "Só o autor pode editar a avaliação")
    campos = dados.model_dump(exclude_unset=True)
    if campos.get("rating") is not None:
        aval.nota = campos["rating"]
    if "comment" in campos:
        aval.comentario = campos["comment"]
    aval.atualizado_em = agora_utc()
    sessao.add(aval)
    sessao.commit()
    sessao.refresh(aval)
    trip = TRIPS.get(aval.corrida_id)  # mantém a memória da simulação em dia
    if trip:
        trip.rating, trip.comment = aval.nota, aval.comentario
    return review_out(aval)


@router.delete("/reviews/{review_id}", status_code=204)
async def delete_review(review_id: int, usuario: Usuario = Depends(obter_usuario_atual), sessao: Session = Depends(obter_sessao)):
    aval = _obter(sessao, review_id)
    if usuario.papel != "gestor" and aval.usuario_id != usuario.id:
        raise HTTPException(403, "Só o autor ou a gestão podem remover a avaliação")
    corrida_id = aval.corrida_id
    sessao.delete(aval)
    sessao.commit()
    trip = TRIPS.get(corrida_id)
    if trip:
        trip.rating, trip.comment = None, None