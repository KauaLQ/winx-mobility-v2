"""Autenticação: Google (token do Supabase, validado por chave pública) e gestor (credenciais -> JWT próprio)."""
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from config import settings
from database import engine, obter_sessao
from models import Motorista, Usuario

esquema_bearer = HTTPBearer()
URL_SUPABASE_AUTH = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
_jwks = PyJWKClient(f"{URL_SUPABASE_AUTH}/.well-known/jwks.json")  # baixa e cacheia as chaves públicas
EMISSOR_GESTOR = "winx-gestor"


# ---------- Senha do gestor (PBKDF2 da biblioteca padrão, sem dependência extra) ----------
def gerar_hash_senha(senha: str, salt: str | None = None) -> str:
    salt = salt or os.urandom(16).hex()
    derivado = hashlib.pbkdf2_hmac("sha256", senha.encode(), bytes.fromhex(salt), 200_000).hex()
    return f"{salt}${derivado}"


def verificar_senha(senha: str, hash_salvo: str) -> bool:
    try:
        salt, _ = hash_salvo.split("$")
    except ValueError:
        return False
    return hmac.compare_digest(gerar_hash_senha(senha, salt), hash_salvo)


def criar_token_gestor(gestor: Usuario) -> str:
    agora = datetime.now(timezone.utc)
    claims = {
        "sub": str(gestor.id),
        "iss": EMISSOR_GESTOR,
        "iat": agora,
        "exp": agora + timedelta(hours=settings.GESTOR_TOKEN_HORAS),
    }
    return jwt.encode(claims, settings.JWT_SECRET, algorithm="HS256")


def garantir_gestor() -> None:
    """Cria/atualiza a conta do gestor a partir do .env (roda no startup).
    Trocar GESTOR_SENHA no .env atualiza a senha no próximo start."""
    email = settings.GESTOR_EMAIL.strip().lower()
    with Session(engine) as sessao:
        gestor = sessao.exec(select(Usuario).where(Usuario.email == email)).first()
        if not gestor:
            gestor = Usuario(nome="Gestão Winx", email=email)
        gestor.papel = "gestor"
        if not gestor.senha_hash or not verificar_senha(settings.GESTOR_SENHA, gestor.senha_hash):
            gestor.senha_hash = gerar_hash_senha(settings.GESTOR_SENHA)
        sessao.add(gestor)
        sessao.commit()


# ---------- Validação do token ----------
def _nao_autorizado() -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciais inválidas", headers={"WWW-Authenticate": "Bearer"})


def _validar_token(token: str) -> dict:
    """Verifica assinatura, expiração e emissor. Lança PyJWTError se algo falhar."""
    if jwt.get_unverified_header(token).get("alg") == "HS256":  # token do gestor (assinado por nós)
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"], issuer=EMISSOR_GESTOR)
    chave = _jwks.get_signing_key_from_jwt(token).key
    return jwt.decode(token, chave, algorithms=["ES256", "RS256"], audience="authenticated", issuer=URL_SUPABASE_AUTH)


def exigir_token(credenciais: HTTPAuthorizationCredentials = Depends(esquema_bearer)) -> dict:
    """Só valida o token, sem consultar o banco. Usado nas rotas de polling (500 ms)."""
    try:
        return _validar_token(credenciais.credentials)
    except jwt.PyJWTError:
        raise _nao_autorizado()


def _obter_ou_criar_usuario(sessao: Session, supabase_id: str, email: str, nome: str, avatar: str | None) -> Usuario:
    usuario = sessao.exec(select(Usuario).where(Usuario.supabase_id == supabase_id)).first()
    if usuario:
        if usuario.avatar_url != avatar:  # mantém a foto do Google em dia
            usuario.avatar_url = avatar
            sessao.add(usuario)
            sessao.commit()
            sessao.refresh(usuario)
        return usuario

    usuario = Usuario(nome=nome, email=email, supabase_id=supabase_id, avatar_url=avatar)
    sessao.add(usuario)
    try:
        sessao.commit()
    except IntegrityError:
        # Duas requisições paralelas no primeiro acesso (StrictMode): a outra criou primeiro.
        sessao.rollback()
        usuario = sessao.exec(select(Usuario).where(Usuario.supabase_id == supabase_id)).first()
        if not usuario:  # não foi corrida: o e-mail pertence a outra conta (ex.: o gestor)
            raise HTTPException(status.HTTP_409_CONFLICT, "Este e-mail já está cadastrado em outra conta")
        return usuario
    sessao.refresh(usuario)
    return usuario


def obter_usuario_atual(claims: dict = Depends(exigir_token), sessao: Session = Depends(obter_sessao)) -> Usuario:
    """Usada nas rotas protegidas: devolve o Usuario do banco (criando no primeiro login com Google)."""
    if claims.get("iss") == EMISSOR_GESTOR:
        usuario = sessao.get(Usuario, int(claims["sub"]))
        if not usuario or usuario.papel != "gestor":
            raise _nao_autorizado()
    else:
        sub, email = claims.get("sub"), claims.get("email")
        if not sub or not email:
            raise _nao_autorizado()
        meta = claims.get("user_metadata") or {}
        nome = (meta.get("full_name") or meta.get("name") or "").strip() or email.split("@")[0]
        avatar = meta.get("avatar_url") or meta.get("picture")
        usuario = _obter_ou_criar_usuario(sessao, sub, email.lower(), nome, avatar)

    if not usuario.ativo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Conta desativada")
    return usuario


def exigir_gestor(usuario: Usuario = Depends(obter_usuario_atual)) -> Usuario:
    if usuario.papel != "gestor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso restrito à gestão")
    return usuario


def obter_motorista_atual(usuario: Usuario = Depends(obter_usuario_atual), sessao: Session = Depends(obter_sessao)) -> Motorista:
    motorista = sessao.exec(select(Motorista).where(Motorista.usuario_id == usuario.id)).first()
    if not motorista or not motorista.ativo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cadastro de motorista não encontrado ou desativado")
    return motorista