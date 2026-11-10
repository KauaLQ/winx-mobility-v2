"""CRUD de veículos + vínculo motorista <-> veículo.
`async def` porque mexe em FLEET (memória da simulação) sem disputar com o loop."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from auth import exigir_gestor, exigir_token, obter_motorista_atual, obter_usuario_atual
from database import obter_sessao
from fleet import BASE_NODE, FLEET, Vehicle, VehicleCreate, VehicleStatus, VehicleUpdate
from models import Corrida, Motorista, Usuario, Veiculo, agora_utc
from persistencia import nome_do_motorista, veiculo_para_memoria

router = APIRouter(prefix="/vehicles", tags=["Veículos"])


def _obter(sessao: Session, vehicle_id: int) -> Veiculo:
    veiculo = sessao.get(Veiculo, vehicle_id)
    if not veiculo:
        raise HTTPException(404, f"Veículo {vehicle_id} não existe")
    return veiculo


def _em_corrida(vehicle_id: int) -> bool:
    v = FLEET.get(vehicle_id)
    return bool(v and v.status == VehicleStatus.EM_CORRIDA)


def _placa_em_uso(sessao: Session, placa: str, ignorar_id: int | None = None) -> bool:
    outro = sessao.exec(select(Veiculo.id).where(Veiculo.placa == placa)).first()
    return outro is not None and outro != ignorar_id


def _sincronizar_motorista(sessao: Session, vehicle_id: int, motorista_id: int | None) -> None:
    v = FLEET.get(vehicle_id)
    if v:
        v.driver_id = motorista_id
        v.driver_name = nome_do_motorista(sessao, motorista_id)


# ---------- CRUD ----------
@router.get("", response_model=list[Vehicle])
async def list_vehicles(_: dict = Depends(exigir_token)):
    return list(FLEET.values())


@router.get("/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: int, _: dict = Depends(exigir_token)):
    if vehicle_id not in FLEET:
        raise HTTPException(404, f"Veículo {vehicle_id} não existe ou está inativo")
    return FLEET[vehicle_id]


@router.post("", response_model=Vehicle, status_code=201)
async def create_vehicle(body: VehicleCreate, _: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    if _placa_em_uso(sessao, body.plate):
        raise HTTPException(409, f"Já existe um veículo com a placa {body.plate}")
    veiculo = Veiculo(nome=body.name, placa=body.plate, tipo=body.type.value, no_atual=BASE_NODE)
    sessao.add(veiculo)
    try:
        sessao.commit()
    except IntegrityError:
        sessao.rollback()
        raise HTTPException(409, f"Já existe um veículo com a placa {body.plate}")
    sessao.refresh(veiculo)
    vehicle = veiculo_para_memoria(sessao, veiculo)
    FLEET[vehicle.id] = vehicle  # entra na simulação na hora, na Portaria
    return vehicle


@router.put("/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: int, body: VehicleUpdate, _: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    veiculo = _obter(sessao, vehicle_id)
    if _em_corrida(vehicle_id):
        raise HTTPException(409, "Veículo em corrida. Aguarde terminar")
    campos = body.model_dump(exclude_unset=True)
    if "plate" in campos and _placa_em_uso(sessao, campos["plate"], ignorar_id=vehicle_id):
        raise HTTPException(409, f"Já existe um veículo com a placa {campos['plate']}")
    if "name" in campos:
        veiculo.nome = campos["name"]
    if "plate" in campos:
        veiculo.placa = campos["plate"]
    if "type" in campos:
        veiculo.tipo = campos["type"].value
    if "active" in campos:
        veiculo.ativo = campos["active"]
        if not veiculo.ativo:
            veiculo.motorista_id = None  # veículo desativado não fica preso a um motorista
    veiculo.atualizado_em = agora_utc()
    sessao.add(veiculo)
    sessao.commit()
    sessao.refresh(veiculo)
    vehicle = veiculo_para_memoria(sessao, veiculo)
    if veiculo.ativo:
        FLEET[vehicle_id] = vehicle
    else:
        FLEET.pop(vehicle_id, None)
    return vehicle


@router.delete("/{vehicle_id}", status_code=204)
async def delete_vehicle(vehicle_id: int, _: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    veiculo = _obter(sessao, vehicle_id)
    if _em_corrida(vehicle_id):
        raise HTTPException(409, "Veículo em corrida. Aguarde terminar")
    if sessao.exec(select(Corrida.id).where(Corrida.veiculo_id == vehicle_id)).first():
        raise HTTPException(409, "Veículo com corridas no histórico. Desative-o (PUT com active=false) em vez de excluir")
    sessao.delete(veiculo)
    sessao.commit()
    FLEET.pop(vehicle_id, None)


# ---------- Vínculo motorista <-> veículo ----------
@router.post("/{vehicle_id}/claim", response_model=Vehicle)
async def claim_vehicle(vehicle_id: int, motorista: Motorista = Depends(obter_motorista_atual), sessao: Session = Depends(obter_sessao)):
    """O motorista escolhe o veículo. Se já tinha outro, é liberado (desde que não esteja em corrida)."""
    veiculo = _obter(sessao, vehicle_id)
    if not veiculo.ativo:
        raise HTTPException(404, f"Veículo {vehicle_id} está inativo")

    if veiculo.motorista_id == motorista.id:  # já é dele (reentrada depois de fechar o app)
        return FLEET.get(vehicle_id) or veiculo_para_memoria(sessao, veiculo)

    anterior = sessao.exec(select(Veiculo).where(Veiculo.motorista_id == motorista.id)).first()
    if anterior:
        if _em_corrida(anterior.id):
            raise HTTPException(409, "Termine a corrida atual antes de trocar de veículo")
        anterior.motorista_id = None
        sessao.add(anterior)
        sessao.flush()

    # Reserva atômica: o UPDATE só vale se ninguém levou o veículo antes (e o UNIQUE é a rede de segurança)
    try:
        resultado = sessao.exec(
            update(Veiculo).where(Veiculo.id == vehicle_id, col(Veiculo.motorista_id).is_(None)).values(motorista_id=motorista.id)
        )
        reservado = resultado.rowcount == 1
    except IntegrityError:
        reservado = False
    if not reservado:
        sessao.rollback()
        raise HTTPException(409, "Este veículo já está em uso por outro motorista")
    sessao.commit()

    if anterior:
        _sincronizar_motorista(sessao, anterior.id, None)
    sessao.refresh(veiculo)
    if vehicle_id not in FLEET:
        FLEET[vehicle_id] = veiculo_para_memoria(sessao, veiculo)
    _sincronizar_motorista(sessao, vehicle_id, motorista.id)
    return FLEET[vehicle_id]


@router.post("/{vehicle_id}/release", response_model=Vehicle)
async def release_vehicle(vehicle_id: int, usuario: Usuario = Depends(obter_usuario_atual), sessao: Session = Depends(obter_sessao)):
    """Libera o veículo: o motorista dono (ao sair) ou a gestão (se o motorista sumiu sem liberar)."""
    veiculo = _obter(sessao, vehicle_id)
    if usuario.papel != "gestor":
        motorista = sessao.exec(select(Motorista).where(Motorista.usuario_id == usuario.id)).first()
        if not motorista or veiculo.motorista_id != motorista.id:
            raise HTTPException(403, "Este veículo não está vinculado a você")
    if _em_corrida(vehicle_id):
        raise HTTPException(409, "Veículo em corrida. Aguarde terminar")
    veiculo.motorista_id = None
    veiculo.atualizado_em = agora_utc()
    sessao.add(veiculo)
    sessao.commit()
    sessao.refresh(veiculo)
    _sincronizar_motorista(sessao, vehicle_id, None)
    return FLEET.get(vehicle_id) or veiculo_para_memoria(sessao, veiculo)