import hashlib
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.models import AuthSession, User
from app.auth.schemas import SignInIn, SignUpIn
from app.db import utcnow
from app.errors import ApiError

_hasher = PasswordHasher()
# Checked when the email is unknown, so a wrong email takes as long as a wrong password.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def _email_taken() -> ApiError:
    message = "An account with this email already exists."
    return ApiError(409, "email_taken", message, [{"field": "email", "message": message}])


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def sign_up(db: Session, data: SignUpIn) -> User:
    email = data.email.lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise _email_taken()
    user = User(
        name=data.name,
        email=email,
        password_hash=_hasher.hash(data.password),
        theme_color=data.theme_color,
        theme_mode=data.theme_mode,
        default_currency=data.default_currency,
        first_day_of_week=data.first_day_of_week,
        expense_amount_color=data.expense_amount_color,
        income_amount_color=data.income_amount_color,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:  # the same email signed up a moment earlier
        db.rollback()
        raise _email_taken() from None
    return user


def authenticate(db: Session, data: SignInIn) -> User:
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    try:
        _hasher.verify(user.password_hash if user else _DUMMY_HASH, data.password)
    except (VerifyMismatchError, InvalidHashError):
        user = None
    if user is None:
        raise ApiError(401, "invalid_credentials", "The email or password is incorrect.")
    if _hasher.check_needs_rehash(user.password_hash):
        user.password_hash = _hasher.hash(data.password)
    return user


def start_session(db: Session, user: User, days: int) -> str:
    """Create a session and return its token. The token itself is never stored."""
    token = secrets.token_urlsafe(32)
    db.add(AuthSession(user_id=user.id, token_hash=_hash_token(token), expires_at=utcnow() + timedelta(days=days)))
    return token


def user_for_token(db: Session, token: str) -> User | None:
    found = db.scalar(select(AuthSession).where(AuthSession.token_hash == _hash_token(token)))
    if found is None:
        return None
    if found.expires_at <= utcnow():
        db.delete(found)
        db.commit()
        return None
    return db.get(User, found.user_id)


def end_session(db: Session, token: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.token_hash == _hash_token(token)))
