"""FuelWise API entry point. Run from the project root:  uvicorn backend.main:app --reload"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from backend import config
from backend.database.init_db import init_db
from backend.auth_service import bootstrap_admin
from backend.database.connection import SessionLocal
from backend.routes import admin, ai, auth, calculate, dashboard, demo, health, maps, settings, trips, vehicles

logger = logging.getLogger("fuelwise")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()  # creates database/fuelwise.db and tables if they do not exist, upgrades older databases
    db = SessionLocal()
    try:
        bootstrap_admin(db)  # only acts when ADMIN_EMAIL and ADMIN_PASSWORD are set
    finally:
        db.close()
    yield


app = FastAPI(title=config.APP_NAME, version=config.APP_VERSION, lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"],
                   allow_headers=["*"], allow_credentials=True)  # credentials: needed for the session cookie

for module in (health, dashboard, calculate, trips, vehicles, ai, maps, auth, settings, demo, admin):
    app.include_router(module.router, prefix="/api")


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(_request: Request, exc: SQLAlchemyError):
    logger.exception("Database error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "A database error occurred. Please try again."})
