from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.orm import sessionmaker

from app.auth.router import router as auth_router
from app.categories.router import router as categories_router
from app.config import Settings
from app.db import make_engine
from app.errors import install_error_handlers
from app.migrate import upgrade_database


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = make_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        upgrade_database(engine)
        yield
        engine.dispose()

    app = FastAPI(title="Hisaab API", lifespan=lifespan)
    app.state.settings = settings
    app.state.sessionmaker = sessionmaker(engine, expire_on_commit=False)
    install_error_handlers(app)
    app.include_router(auth_router)
    app.include_router(categories_router)

    @app.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
