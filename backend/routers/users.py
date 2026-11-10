from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from auth import exigir_gestor, obter_usuario_atual
from database import obter_sessao
from models import Usuario, agora_utc
from schemas import UserOut, UserUpdate, user_out

router = APIRouter(prefix="/users", tags=["Usuários"])

_CAMPOS = {"name": "nome", "phone": "telefone", "active": "ativo"}


def _aplicar(usuario: Usuario, dados: UserUpdate, permitir_ativo: bool) -> None:
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        if campo == "active" and not permitir_ativo:
            continue
        setattr(usuario, _CAMPOS[campo], valor)
    usuario.atualizado_em = agora_utc()


def _obter(sessao: Session, user_id: int) -> Usuario:
    usuario = sessao.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(404, "Usuário não encontrado")
    return usuario


# ---------- O próprio usuário (o front chama a cada login) ----------
@router.get("/me", response_model=UserOut)
def get_me(usuario: Usuario = Depends(obter_usuario_atual)):
    return user_out(usuario)


@router.put("/me", response_model=UserOut)
def update_me(dados: UserUpdate, usuario: Usuario = Depends(obter_usuario_atual), sessao: Session = Depends(obter_sessao)):
    _aplicar(usuario, dados, permitir_ativo=False)
    sessao.add(usuario)
    sessao.commit()
    sessao.refresh(usuario)
    return user_out(usuario)


# ---------- Gestão ----------
@router.get("", response_model=list[UserOut])
def list_users(_: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    return [user_out(u) for u in sessao.exec(select(Usuario).order_by(Usuario.id)).all()]


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, _: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    return user_out(_obter(sessao, user_id))


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, dados: UserUpdate, _: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    usuario = _obter(sessao, user_id)
    _aplicar(usuario, dados, permitir_ativo=True)
    sessao.add(usuario)
    sessao.commit()
    sessao.refresh(usuario)
    return user_out(usuario)


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, gestor: Usuario = Depends(exigir_gestor), sessao: Session = Depends(obter_sessao)):
    """Desativa a conta (não apaga: o histórico de corridas e avaliações continua apontando para ela)."""
    if user_id == gestor.id:
        raise HTTPException(409, "Você não pode desativar a própria conta")
    usuario = _obter(sessao, user_id)
    usuario.ativo = False
    usuario.atualizado_em = agora_utc()
    sessao.add(usuario)
    sessao.commit()