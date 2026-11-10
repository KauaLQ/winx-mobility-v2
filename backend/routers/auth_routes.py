from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from auth import criar_token_gestor, verificar_senha
from database import obter_sessao
from models import Usuario
from schemas import ManagerLogin, TokenOut

router = APIRouter(prefix="/auth", tags=["Autenticação"])


# Usuário e motorista entram pelo Google direto no Supabase; o backend só valida o token deles.
# Este login é só do gestor (credenciais padrão).
@router.post("/manager/login", response_model=TokenOut)
def login_gestor(dados: ManagerLogin, sessao: Session = Depends(obter_sessao)):
    gestor = sessao.exec(
        select(Usuario).where(Usuario.email == dados.email.strip().lower(), Usuario.papel == "gestor")
    ).first()
    if not gestor or not gestor.ativo or not gestor.senha_hash or not verificar_senha(dados.password, gestor.senha_hash):
        raise HTTPException(401, "E-mail ou senha inválidos")
    return TokenOut(access_token=criar_token_gestor(gestor))