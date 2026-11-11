from collections.abc import Iterator
from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    """Naive UTC, so values compare the same whether or not the database keeps time zones (SQLite does not)."""
    return datetime.now(UTC).replace(tzinfo=None)


def make_engine(url: str) -> Engine:
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args)


def get_db(request: Request) -> Iterator[Session]:
    """One database session per request. The code that changes things commits."""
    factory: sessionmaker[Session] = request.app.state.sessionmaker
    with factory() as db:
        yield db
