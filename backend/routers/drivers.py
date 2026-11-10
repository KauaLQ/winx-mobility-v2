from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from auth import exigir_gestor, obter_motorista_atual, obter_usuario_atual
from database import obter_sessao
from models import Avaliacao, Motorista, Usuario, Veiculo, agora_utc
from schemas import DriverOut, DriverUpdate

router = APIRouter(prefix="/drivers", tags=["Motoristas"])


def _driver_out(sessao: Session, m: Motorista) -> DriverOut:
    usuario = sessao.get(Usuario, m.usuario_id)
    vehicle_id = sessao.exec(select(Veiculo.id).where(Veiculo.motorista_id == m.id)).first()
    media, total = sessao.exec(
        select(func.avg(Avaliacao.nota), func.count(Avaliacao.id)).where(Avaliacao.motorista_id == m.id)
    ).one()
    return DriverOut(
        id=m.id, user_id=m.usuario_id, name=usuario.nome, email=usuario.email, phone=m.telefone, license=m.cnh,
        active=m.ativo, vehicle_id=vehicle_id,
        rating_avg=round(float(media), 2) if media is not None else None, rating_count=total,
    )


def _obter(sessao: Session, driver_id: int) -> Motorista:
    motorista = sessao.get(Motorista, driver_id)
    if not motorista:
        raise HTTPException(404, "Motorista não encontrado")
    return motorista


def _aplicar(m: Motorista, dados: DriverUpdate, permitir_ativo: bool) -> None:
    campos = {"phone": "telefone", "license": "cnh", "active": "ativo"}
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        if campo == "active" and not permitir_ativo:
            continue
        setattr(m, campos[campo], valor)
    m.atualizado_em = agora_utc()


# ---------- O próprio motorista ----------
@router.post("/me", response_model=DriverOut)
def register_me(usuario: Usuario = Depends(obter_usuario_atual), sessao: Session = Depends(obter_sessao)):
    """Idempotente: cria o cadastro de motorista no primeiro login como Motorista e devolve o existente nos demais."""
    if usuario.papel != "usuario":
        raise HTTPException(403, "A conta de gestão não pode ser motorista")
    motorista = sessao.exec(select(Motorista).where(Motorista.usuario_id == usuario.id)).first()
    if not motorista:
        sessao.add(Motorista(usuario_id=usuario.id, telefone=usuario.telefone))
        try:
            sessao.commit()
        except IntegrityError:  # duas requisições paralelas (StrictMode): a outra criou primeiro
            sessao.rollback()
        motorista = sessao.exec(select(Motorista).where(Motorista.usuario_id == usuario.id)).one()
    if not motorista.ativo:
        raise HTTPException(403, "Cadastro de motorista desativado")
    return _driver_out(sessao, motorista)


@router.get("/me", response_model=DriverOut)
def get_me(motorista: Motorista = Depends(obter_motorista_atual), sessao: Session = Depends(obter_sessao)):
    return _driver_out(sessao, motorista)


@router.put("/me", response_model=DriverOut)
def update_me(dados: DriverUpdate, motorista: Motorista = Depends(obter_motorista_atual), sessao: Session = Depends(obter_sessao)):
    _aplicar(motorista, dados, permitir_ativo=False)
    sessao.add(motorista)
    sessao.commit()
    sessao.refresh(motorista)
    return _driver_out(sessao, motorista)


# ---------- Gestão ----------
@router.get("", response_model=list[DriverOut])
def list_drivers(_: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    return [_driver_out(sessao, m) for m in sessao.exec(select(Motorista).order_by(Motorista.id)).all()]


@router.get("/{driver_id}", response_model=DriverOut)
def get_driver(driver_id: int, _: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    return _driver_out(sessao, _obter(sessao, driver_id))


@router.put("/{driver_id}", response_model=DriverOut)
def update_driver(driver_id: int, dados: DriverUpdate, _: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    motorista = _obter(sessao, driver_id)
    if dados.active is False:
        _exigir_sem_veiculo(sessao, motorista)
    _aplicar(motorista, dados, permitir_ativo=True)
    sessao.add(motorista)
    sessao.commit()
    sessao.refresh(motorista)
    return _driver_out(sessao, motorista)


@router.delete("/{driver_id}", status_code=204)
def delete_driver(driver_id: int, _: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    """Desativa o motorista (o histórico de corridas e avaliações continua apontando para ele)."""
    motorista = _obter(sessao, driver_id)
    _exigir_sem_veiculo(sessao, motorista)
    motorista.ativo = False
    motorista.atualizado_em = agora_utc()
    sessao.add(motorista)
    sessao.commit()


def _exigir_sem_veiculo(sessao: Session, motorista: Motorista) -> None:
    veiculo = sessao.exec(select(Veiculo).where(Veiculo.motorista_id == motorista.id)).first()
    if veiculo:
        raise HTTPException(409, f"Motorista vinculado a '{veiculo.nome}'. Libere o veículo antes (POST /vehicles/{veiculo.id}/release)")