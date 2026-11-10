"""Ponte entre o estado em memória da simulação (fleet.py) e o banco de dados."""
from sqlmodel import Session, col, select

from database import engine
from fleet import (
    BASE_NODE, CLOCK, DEFAULT_ALLOWED_KINDS, FLEET, TRIPS,
    RequestKind, TransportRequest, Trip, TripPhase, Vehicle,
)
from graph_model import FACTORY_GRAPH, VehicleType
from models import Avaliacao, Corrida, Motorista, Usuario, Veiculo, agora_utc

FASES_ABERTAS = [TripPhase.AGUARDANDO.value, TripPhase.BUSCANDO.value, TripPhase.EM_TRANSPORTE.value]

FROTA_DEMO = [  # (nome, placa, tipo, nó inicial)
    ("Carro 1", "WNX1A01", "carro", 1),
    ("Carro 2", "WNX1A02", "carro", 1),
    ("Carro 3", "WNX1A03", "carro", 1),
    ("Van 1", "WNX1A04", "van", 3),
    ("Ônibus 1", "WNX1A05", "onibus", 2),
    ("Caminhão 1", "WNX1A06", "caminhao", 8),
    ("Caminhão 2", "WNX1A07", "caminhao", 6),
]


# ---------- Banco -> memória ----------

def nome_do_motorista(sessao: Session, motorista_id: int | None) -> str | None:
    if motorista_id is None:
        return None
    return sessao.exec(
        select(Usuario.nome).join(Motorista, col(Motorista.usuario_id) == col(Usuario.id)).where(Motorista.id == motorista_id)
    ).first()


def veiculo_para_memoria(sessao: Session, v: Veiculo) -> Vehicle:
    tipo = VehicleType(v.tipo)
    no = v.no_atual if v.no_atual in FACTORY_GRAPH else BASE_NODE
    pos = FACTORY_GRAPH.nodes[no]
    return Vehicle(
        id=v.id, name=v.nome, plate=v.placa, type=tipo, current_node=no,
        allowed_kinds=list(DEFAULT_ALLOWED_KINDS[tipo]),
        driver_id=v.motorista_id, driver_name=nome_do_motorista(sessao, v.motorista_id),
        x=pos["x"], y=pos["y"],
    )


def _corrida_para_memoria(c: Corrida, nome_veiculo: str | None, aval: Avaliacao | None) -> Trip:
    return Trip(
        id=c.id,
        request=TransportRequest(
            kind=RequestKind(c.tipo_carga), origin_node=c.no_origem, destination_node=c.no_destino,
            modal=VehicleType(c.modal), requested_by=c.usuario_id,
        ),
        phase=TripPhase(c.fase), eta_pickup_s=c.eta_busca_s, eta_total_s=c.eta_total_s, distance_m=c.distancia_m,
        created_at_s=c.criada_sim_s, vehicle_id=c.veiculo_id, vehicle_name=nome_veiculo, driver_id=c.motorista_id,
        completed_at_s=c.concluida_sim_s, reroutes=c.recalculos,
        rating=aval.nota if aval else None, comment=aval.comentario if aval else None,
    )


def carregar_estado(voltar_a_base: bool = False) -> None:
    """Monta a simulação a partir do banco (startup e reset).
    Corridas que ficaram abertas não têm como continuar e viram 'cancelada'."""
    with Session(engine) as sessao:
        agora = agora_utc()
        for c in sessao.exec(select(Corrida).where(col(Corrida.fase).in_(FASES_ABERTAS))).all():
            c.fase, c.cancelada_em = TripPhase.CANCELADA.value, agora
            sessao.add(c)
        todos = sessao.exec(select(Veiculo)).all()
        if voltar_a_base:
            for v in todos:
                v.no_atual = BASE_NODE
                sessao.add(v)
        sessao.commit()

        FLEET.clear()
        TRIPS.clear()
        for _, _, edge in FACTORY_GRAPH.edges(data=True):
            edge["load"] = 0

        for v in todos:
            if v.ativo:
                FLEET[v.id] = veiculo_para_memoria(sessao, v)

        nomes = {v.id: v.nome for v in todos}
        avaliacoes = {a.corrida_id: a for a in sessao.exec(select(Avaliacao)).all()}
        corridas = sessao.exec(select(Corrida).order_by(Corrida.id)).all()
        for c in corridas:
            TRIPS[c.id] = _corrida_para_memoria(c, nomes.get(c.veiculo_id), avaliacoes.get(c.id))
        # O relógio continua de onde parou, para os horários do histórico fazerem sentido
        CLOCK["s"] = max((c.concluida_sim_s or c.criada_sim_s for c in corridas), default=0.0)


def semear_frota_demo() -> None:
    """Cria a frota de demonstração se a tabela de veículos estiver vazia."""
    with Session(engine) as sessao:
        if sessao.exec(select(Veiculo.id)).first() is not None:
            return
        for nome, placa, tipo, no in FROTA_DEMO:
            sessao.add(Veiculo(nome=nome, placa=placa, tipo=tipo, no_atual=no))
        sessao.commit()


# ---------- Memória -> banco ----------

def criar_corrida(sessao: Session, trip: Trip) -> int:
    c = Corrida(
        usuario_id=trip.request.requested_by, tipo_carga=trip.request.kind.value, modal=trip.request.modal.value,
        no_origem=trip.request.origin_node, no_destino=trip.request.destination_node, fase=trip.phase.value,
        eta_busca_s=trip.eta_pickup_s, eta_total_s=trip.eta_total_s, distancia_m=trip.distance_m,
        criada_sim_s=trip.created_at_s,
    )
    sessao.add(c)
    sessao.commit()
    sessao.refresh(c)
    return c.id


def _aplicar(c: Corrida, t: dict) -> None:
    """Copia o estado da viagem (dict de Trip.model_dump) para a linha do banco."""
    fase_anterior = c.fase
    c.fase = TripPhase(t["phase"]).value
    c.veiculo_id, c.motorista_id = t["vehicle_id"], t["driver_id"]
    c.eta_busca_s, c.eta_total_s, c.distancia_m = t["eta_pickup_s"], t["eta_total_s"], t["distance_m"]
    c.recalculos, c.concluida_sim_s = t["reroutes"], t["completed_at_s"]
    if c.fase != fase_anterior:  # carimba o momento real de cada mudança de fase
        campo = {"buscando": "aceita_em", "em_transporte": "iniciada_em",
                 "concluida": "concluida_em", "cancelada": "cancelada_em"}.get(c.fase)
        if campo:
            setattr(c, campo, agora_utc())


def salvar_corrida(sessao: Session, trip: Trip) -> None:
    c = sessao.get(Corrida, trip.id)
    if c:
        _aplicar(c, trip.model_dump())
        sessao.add(c)
        sessao.commit()


def salvar_corridas(snapshots: list[dict]) -> None:
    """Chamada pelo loop da simulação, numa thread. Recebe só dados simples (fotografados no event loop)."""
    with Session(engine) as sessao:
        for snap in snapshots:
            t = snap["trip"]
            c = sessao.get(Corrida, t["id"])
            if not c:
                continue
            _aplicar(c, t)
            sessao.add(c)
            if TripPhase(t["phase"]) == TripPhase.CONCLUIDA and t["vehicle_id"] and snap["node"] is not None:
                v = sessao.get(Veiculo, t["vehicle_id"])
                if v:
                    v.no_atual = snap["node"]  # onde o veículo ficou parado
                    sessao.add(v)
        sessao.commit()


def criar_avaliacao(sessao: Session, trip: Trip, rating: int, comment: str | None) -> None:
    sessao.add(Avaliacao(
        corrida_id=trip.id, usuario_id=trip.request.requested_by, motorista_id=trip.driver_id,
        veiculo_id=trip.vehicle_id, nota=rating, comentario=comment,
    ))
    sessao.commit()