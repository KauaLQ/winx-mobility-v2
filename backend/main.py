from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import simulation
from fleet_router import router as fleet_router
from router import router as map_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    simulation.stop_loop()  # encerra o loop de simulação ao desligar o servidor


app = FastAPI(title="Winx Mobility - Roteamento e Despacho", lifespan=lifespan)

# MVP: libera qualquer origem para o frontend. Restrinja em produção.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(map_router)
app.include_router(fleet_router)