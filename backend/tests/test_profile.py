from collections.abc import Iterator
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import Base, make_engine
from app.main import create_app
from app.migrate import upgrade_database

NEW_USER = {"name": "Asha", "email": "asha@example.com", "password": "correct horse"}


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", _env_file=None))
    with TestClient(app) as test_client:
        test_client.post("/api/v1/auth/sign-up", json=NEW_USER)
        yield test_client


def test_theme_color_starts_as_default(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").json()["theme_color"] is None


def test_theme_color_is_saved_in_lower_case(client: TestClient) -> None:
    response = client.patch("/api/v1/auth/me", json={"theme_color": "#2196F3"})
    assert response.status_code == 200
    assert response.json()["theme_color"] == "#2196f3"
    assert client.get("/api/v1/auth/me").json()["theme_color"] == "#2196f3"


def test_null_goes_back_to_default(client: TestClient) -> None:
    client.patch("/api/v1/auth/me", json={"theme_color": "#2196f3"})
    assert client.patch("/api/v1/auth/me", json={"theme_color": None}).json()["theme_color"] is None


def test_leaving_the_field_out_changes_nothing(client: TestClient) -> None:
    client.patch("/api/v1/auth/me", json={"theme_color": "#2196f3"})
    assert client.patch("/api/v1/auth/me", json={}).json()["theme_color"] == "#2196f3"


@pytest.mark.parametrize("bad", ["blue", "#12345", "#1234567", "#gggggg", "2196f3"])
def test_theme_color_must_be_hex(client: TestClient, bad: str) -> None:
    response = client.patch("/api/v1/auth/me", json={"theme_color": bad})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "theme_color"


def test_update_needs_a_session(client: TestClient) -> None:
    client.cookies.clear()
    assert client.patch("/api/v1/auth/me", json={"theme_color": "#2196f3"}).status_code == 401


def test_migrations_match_the_models(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'fresh.db'}")
    upgrade_database(engine)
    with engine.connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []


def test_database_from_before_migrations_is_upgraded(tmp_path: Path) -> None:
    """A database made by the old create_all (no theme_color, no alembic_version) keeps its users."""
    engine = make_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL,"
                " password_hash VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL)"
            )
        )
        connection.execute(sa.text("CREATE UNIQUE INDEX ix_users_email ON users (email)"))
        connection.execute(
            sa.text(
                "CREATE TABLE auth_sessions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id)"
                " ON DELETE CASCADE, token_hash VARCHAR(64) NOT NULL, created_at DATETIME NOT NULL,"
                " expires_at DATETIME NOT NULL)"
            )
        )
        connection.execute(sa.text("INSERT INTO users VALUES (1, 'Old', 'old@example.com', 'x', '2026-11-01')"))

    upgrade_database(engine)

    with engine.connect() as connection:
        row = connection.execute(sa.text("SELECT name, theme_color FROM users")).one()
    assert tuple(row) == ("Old", None)


def test_preferences_start_with_the_defaults(client: TestClient) -> None:
    me = client.get("/api/v1/auth/me").json()
    assert (me["default_currency"], me["first_day_of_week"]) == ("INR", 0)
    assert (me["expense_amount_color"], me["income_amount_color"]) == ("red", "green")
    assert me["theme_mode"] == "system"


def test_preferences_can_be_chosen_at_sign_up(tmp_path: Path) -> None:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'prefs.db'}", _env_file=None))
    with TestClient(app) as test_client:
        chosen = {
            "theme_color": "#3F51B5",
            "theme_mode": "dark",
            "default_currency": "usd",
            "first_day_of_week": 1,
            "expense_amount_color": "blue",
            "income_amount_color": "black_or_white",
        }
        me = test_client.post("/api/v1/auth/sign-up", json={**NEW_USER, **chosen}).json()
    assert me["theme_color"] == "#3f51b5"
    assert me["theme_mode"] == "dark"
    assert me["default_currency"] == "USD"
    assert (me["first_day_of_week"], me["expense_amount_color"], me["income_amount_color"]) == (
        1,
        "blue",
        "black_or_white",
    )


def test_preferences_can_be_changed_one_at_a_time(client: TestClient) -> None:
    me = client.patch("/api/v1/auth/me", json={"first_day_of_week": 1}).json()
    assert me["first_day_of_week"] == 1
    assert me["default_currency"] == "INR"
    me = client.patch("/api/v1/auth/me", json={"default_currency": "EUR", "income_amount_color": "yellow"}).json()
    assert (me["first_day_of_week"], me["default_currency"], me["income_amount_color"]) == (1, "EUR", "yellow")


@pytest.mark.parametrize(
    ("field", "bad"),
    [
        ("theme_mode", "sepia"),
        ("theme_mode", None),
        ("default_currency", "RUPEE"),
        ("default_currency", None),
        ("first_day_of_week", 7),
        ("first_day_of_week", None),
        ("expense_amount_color", "purple"),
        ("income_amount_color", None),
    ],
)
def test_bad_preferences_are_refused(client: TestClient, field: str, bad: object) -> None:
    response = client.patch("/api/v1/auth/me", json={field: bad})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field


def test_theme_mode_can_be_changed(client: TestClient) -> None:
    assert client.patch("/api/v1/auth/me", json={"theme_mode": "light"}).json()["theme_mode"] == "light"
    assert client.get("/api/v1/auth/me").json()["theme_mode"] == "light"
