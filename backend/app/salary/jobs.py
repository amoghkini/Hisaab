"""The pay-day job: drafts the payslips whose pay day has come, in the background while the app runs."""

import asyncio
import logging
from datetime import date

from sqlalchemy.orm import Session, sessionmaker

from app.salary.payslips import generate_for_everyone

log = logging.getLogger(__name__)


def _run_once(factory: sessionmaker[Session]) -> int:
    with factory() as db:
        return generate_for_everyone(db, date.today())


async def run_payslip_job(factory: sessionmaker[Session], interval_seconds: int) -> None:
    """At start-up and then every `interval_seconds`. A failed run is logged and tried again next time."""
    while True:
        try:
            made = await asyncio.to_thread(_run_once, factory)
            if made:
                log.info("Drafted %d payslip(s)", made)
        except Exception:
            log.exception("The pay-day job failed")
        await asyncio.sleep(interval_seconds)
