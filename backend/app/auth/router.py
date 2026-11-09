from fastapi import APIRouter, Request, Response, status

from app.auth.deps import DB, AppSettings, CurrentUser, session_token
from app.auth.models import User
from app.auth.schemas import SignInIn, SignUpIn, UpdateMeIn, UserOut
from app.auth.service import authenticate, end_session, sign_up, start_session
from app.categories.service import create_preset_categories
from app.config import Settings

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

COOKIE_PATH = "/api"


def _signed_in(db: DB, response: Response, settings: Settings, user: User) -> UserOut:
    token = start_session(db, user, settings.session_days)
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
def sign_up_route(data: SignUpIn, db: DB, response: Response, settings: AppSettings) -> UserOut:
    """Create an account, with the preset categories if asked, and sign straight in. All or nothing."""
    user = sign_up(db, data)
    if data.use_preset_categories:
        create_preset_categories(db, user.id)
    return _signed_in(db, response, settings, user)


@router.post("/sign-in")
def sign_in_route(data: SignInIn, db: DB, response: Response, settings: AppSettings) -> UserOut:
    return _signed_in(db, response, settings, authenticate(db, data))


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
    for name, value in data.changes().items():
        setattr(user, name, value)
    db.commit()
    return UserOut.model_validate(user)
