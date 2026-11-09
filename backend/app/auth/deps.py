from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.service import user_for_token
from app.config import Settings
from app.db import get_db
from app.errors import ApiError

DB = Annotated[Session, Depends(get_db)]


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


AppSettings = Annotated[Settings, Depends(get_settings)]


def session_token(request: Request) -> str | None:
    """The browser sends the session cookie; the Android app will send `Authorization: Bearer <token>`."""
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip() or None
    return request.cookies.get(get_settings(request).cookie_name)


def current_user(request: Request, db: DB) -> User:
    token = session_token(request)
    user = user_for_token(db, token) if token else None
    if user is None:
        raise ApiError(401, "unauthorized", "Please log in to continue.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
