from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import persistencia
import simulation
from auth import garantir_gestor
from config import settings
from database import aplicar_migracoes_simples, criar_tabelas
from fleet_router import router as fleet_router
from router import router as map_router
from routers import auth_routes, drivers, reviews, trips, users, vehicles


@asynccontextmanager
async def lifespan(app: FastAPI):
    criar_tabelas()
    aplicar_migracoes_simples()
    garantir_gestor()
    if settings.SEED_FROTA_DEMO:
        persistencia.semear_frota_demo()
    persistencia.carregar_estado()  # frota e histórico do banco -> memória da simulação
    yield
    simulation.stop_loop()  # encerra o loop de simulação ao desligar o servidor


app = FastAPI(title="Winx Mobility - Roteamento e Despacho", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

app.include_router(auth_routes.router)
app.include_router(users.router)
app.include_router(drivers.router)
app.include_router(vehicles.router)
app.include_router(trips.router)
app.include_router(reviews.router)
app.include_router(map_router)
app.include_router(fleet_router)