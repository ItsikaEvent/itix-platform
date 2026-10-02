from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401  (enregistre les tables)
from app.api.routes import admin, auth, health, public
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.services.bootstrap import seed_admin


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    seed_admin()
    yield


app = FastAPI(title="Billetterie Concerts API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins_list or ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+|https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (health.router, auth.router, public.router, admin.router):
    app.include_router(r)
