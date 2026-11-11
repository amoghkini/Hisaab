from fastapi import APIRouter, Request, Response, status

from app.auth.deps import DB, AppSettings, CurrentSession, CurrentUser, session_token
from app.auth.models import User
from app.auth.schemas import PasswordChangeIn, SessionOut, SignInIn, SignUpIn, UpdateMeIn, UserOut
from app.auth.service import (
    authenticate,
    change_password,
    end_other_sessions,
    end_session,
    end_session_by_id,
    list_sessions,
    sign_up,
    start_session,
    update_me,
)
from app.categories.service import create_preset_categories
from app.config import Settings

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

COOKIE_PATH = "/api"


def _signed_in(db: DB, request: Request, response: Response, settings: Settings, user: User) -> UserOut:
    token = start_session(db, user, settings.session_days, request.headers.get("User-Agent", ""))
    db.commit()
    response.set_cookie(
        settings.cookie_name,
        token,
        max_age=settings.session_days * 24 * 3600,
        path=COOKIE_PATH,
        httponly=True,  # page scripts cannot read it
        secure=settings.cookie_secure,
        samesite="lax",
    )
    return UserOut.model_validate(user)


@router.post("/sign-up", status_code=status.HTTP_201_CREATED)
def sign_up_route(data: SignUpIn, db: DB, request: Request, response: Response, settings: AppSettings) -> UserOut:
    """Create an account, with the preset categories if asked, and sign straight in. All or nothing."""
    user = sign_up(db, data)
    if data.use_preset_categories:
        create_preset_categories(db, user.id)
    return _signed_in(db, request, response, settings, user)


@router.post("/sign-in")
def sign_in_route(data: SignInIn, db: DB, request: Request, response: Response, settings: AppSettings) -> UserOut:
    return _signed_in(db, request, response, settings, authenticate(db, data))


@router.post("/sign-out", status_code=status.HTTP_204_NO_CONTENT)
def sign_out_route(request: Request, db: DB, settings: AppSettings) -> Response:
    """End this session. Works even when the session has already gone."""
    token = session_token(request)
    if token:
        end_session(db, token)
        db.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(settings.cookie_name, path=COOKIE_PATH)
    return response


@router.get("/me")
def me_route(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me")
def update_me_route(data: UpdateMeIn, user: CurrentUser, db: DB) -> UserOut:
    return UserOut.model_validate(update_me(db, user, data))


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password_route(data: PasswordChangeIn, user: CurrentUser, session: CurrentSession, db: DB) -> Response:
    """Change the password. Every other device is signed out; this one stays signed in."""
    change_password(db, user, data, session.id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/sessions")
def sessions_route(user: CurrentUser, session: CurrentSession, db: DB) -> list[SessionOut]:
    """Every browser and device signed in to this account, the most recently used first."""
    return [
        SessionOut.model_validate(item).model_copy(update={"current": item.id == session.id})
        for item in list_sessions(db, user.id)
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def end_session_route(session_id: int, user: CurrentUser, db: DB) -> Response:
    """Sign out one device."""
    end_session_by_id(db, user.id, session_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/sessions", status_code=status.HTTP_204_NO_CONTENT)
def end_other_sessions_route(user: CurrentUser, session: CurrentSession, db: DB) -> Response:
    """Sign out every device except this one."""
    end_other_sessions(db, user.id, session.id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
