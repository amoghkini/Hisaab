import hashlib
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import SALARY_CATEGORIES, Account
from app.auth.models import AuthSession, User
from app.auth.schemas import PasswordChangeIn, SignInIn, SignUpIn, UpdateMeIn
from app.db import utcnow
from app.errors import ApiError

_hasher = PasswordHasher()
# Checked when the email is unknown, so a wrong email takes as long as a wrong password.
_DUMMY_HASH = _hasher.hash("not-a-real-password")
# How stale a session's "last seen" may get before a request updates it, so most requests do not write.
_TOUCH_EVERY = timedelta(minutes=5)
USER_AGENT_MAX = 255


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


def start_session(db: Session, user: User, days: int, user_agent: str = "") -> str:
    """Create a session and return its token. The token itself is never stored."""
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=_hash_token(token),
            expires_at=utcnow() + timedelta(days=days),
            user_agent=user_agent[:USER_AGENT_MAX],
        )
    )
    return token


def session_for_token(db: Session, token: str) -> AuthSession | None:
    """The live session with this token. Updates when it was last seen, at most every few minutes."""
    found = db.scalar(select(AuthSession).where(AuthSession.token_hash == _hash_token(token)))
    if found is None:
        return None
    now = utcnow()
    if found.expires_at <= now:
        db.delete(found)
        db.commit()
        return None
    if found.last_seen_at is None or now - found.last_seen_at >= _TOUCH_EVERY:
        found.last_seen_at = now
        db.commit()
    return found


def user_for_token(db: Session, token: str) -> User | None:
    found = session_for_token(db, token)
    return db.get(User, found.user_id) if found else None


def end_session(db: Session, token: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.token_hash == _hash_token(token)))


def check_password(user: User, password: str, field: str = "password") -> None:
    """Refuse with a field error unless this is the user's password."""
    try:
        _hasher.verify(user.password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        message = "The password is incorrect."
        raise ApiError(400, "wrong_password", message, [{"field": field, "message": message}]) from None


def update_me(db: Session, user: User, data: UpdateMeIn) -> User:
    changes = data.changes()
    for field, allowed_categories, message in (
        ("default_account_id", None, "Choose one of your accounts."),
        ("salary_account_id", SALARY_CATEGORIES, "Choose one of your savings or current accounts."),
    ):
        account_id = changes.get(field)
        if account_id is None:
            continue
        found = db.execute(select(Account.user_id, Account.category).where(Account.id == account_id)).one_or_none()
        if (
            found is None
            or found.user_id != user.id
            or (allowed_categories and found.category not in allowed_categories)
        ):
            raise ApiError(422, "validation_failed", message, [{"field": field, "message": message}])
    for name, value in changes.items():
        setattr(user, name, value)
    db.commit()
    return user


def change_password(db: Session, user: User, data: PasswordChangeIn, keep_session_id: int) -> None:
    """Set a new password and sign out every other device."""
    check_password(user, data.current_password, "current_password")
    user.password_hash = _hasher.hash(data.new_password)
    end_other_sessions(db, user.id, keep_session_id)


def list_sessions(db: Session, user_id: int) -> list[AuthSession]:
    """The user's live sessions, the most recently used first."""
    sessions = db.scalars(
        select(AuthSession).where(AuthSession.user_id == user_id, AuthSession.expires_at > utcnow())
    ).all()
    return sorted(sessions, key=lambda item: item.last_seen_at or item.created_at, reverse=True)


def end_session_by_id(db: Session, user_id: int, session_id: int) -> None:
    found = db.scalar(select(AuthSession).where(AuthSession.id == session_id, AuthSession.user_id == user_id))
    if found is None:
        raise ApiError(404, "session_not_found", "That session has already ended.")
    db.delete(found)


def end_other_sessions(db: Session, user_id: int, keep_session_id: int) -> None:
    db.execute(delete(AuthSession).where(AuthSession.user_id == user_id, AuthSession.id != keep_session_id))
