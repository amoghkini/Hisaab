import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from sqlalchemy.orm import sessionmaker

from app.accounts.router import router as accounts_router
from app.auth.router import router as auth_router
from app.categories.router import router as categories_router
from app.config import Settings
from app.data.router import router as data_router
from app.db import make_engine
from app.errors import install_error_handlers
from app.migrate import upgrade_database
from app.notifications.router import router as notifications_router
from app.overview.router import router as overview_router
from app.salary.jobs import run_payslip_job
from app.salary.router import router as salary_router
from app.transactions.router import router as transactions_router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = make_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        upgrade_database(engine)
        job = None
        if settings.payslip_job_interval_seconds > 0:
            job = asyncio.create_task(run_payslip_job(app.state.sessionmaker, settings.payslip_job_interval_seconds))
        yield
        if job is not None:
            job.cancel()
            with suppress(asyncio.CancelledError):
                await job
        engine.dispose()

    app = FastAPI(title="Hisaab API", lifespan=lifespan)
    app.state.settings = settings
    app.state.sessionmaker = sessionmaker(engine, expire_on_commit=False)
    install_error_handlers(app)
    app.include_router(auth_router)
    app.include_router(categories_router)
    app.include_router(accounts_router)
    app.include_router(transactions_router)
    app.include_router(overview_router)
    app.include_router(data_router)
    app.include_router(salary_router)
    app.include_router(notifications_router)

    @app.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
