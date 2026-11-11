from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

NEW_USER = {"name": "Asha", "email": "Asha@Example.com", "password": "correct horse"}


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", _env_file=None))
    with TestClient(app) as test_client:
        yield test_client


def test_sign_up_signs_in(client: TestClient) -> None:
    response = client.post("/api/v1/auth/sign-up", json=NEW_USER)
    assert response.status_code == 201
    assert response.json()["email"] == "asha@example.com"
    assert "hisaab_session" in response.cookies

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["name"] == "Asha"


def test_sign_up_twice_is_refused(client: TestClient) -> None:
    client.post("/api/v1/auth/sign-up", json=NEW_USER)
    response = client.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "asha@example.com"})
    assert response.status_code == 409
    assert response.json()["error"]["details"][0]["field"] == "email"


def test_sign_up_validates_fields(client: TestClient) -> None:
    response = client.post("/api/v1/auth/sign-up", json={"name": "  ", "email": "nope", "password": "short"})
    assert response.status_code == 422
    fields = {detail["field"] for detail in response.json()["error"]["details"]}
    assert fields == {"name", "email", "password"}


def test_sign_in_and_out(client: TestClient) -> None:
    client.post("/api/v1/auth/sign-up", json=NEW_USER)
    client.cookies.clear()
    assert client.get("/api/v1/auth/me").status_code == 401

    response = client.post("/api/v1/auth/sign-in", json={"email": "asha@example.com", "password": "correct horse"})
    assert response.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 200

    assert client.post("/api/v1/auth/sign-out").status_code == 204
    client.cookies.clear()
    assert client.get("/api/v1/auth/me").status_code == 401


def test_sign_out_ends_the_session_on_the_server(client: TestClient) -> None:
    token = client.post("/api/v1/auth/sign-up", json=NEW_USER).cookies["hisaab_session"]
    client.post("/api/v1/auth/sign-out")
    client.cookies.clear()
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_bearer_token_works(client: TestClient) -> None:
    token = client.post("/api/v1/auth/sign-up", json=NEW_USER).cookies["hisaab_session"]
    client.cookies.clear()
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


@pytest.mark.parametrize(
    "credentials",
    [
        {"email": "asha@example.com", "password": "wrong password"},
        {"email": "nobody@example.com", "password": "correct horse"},
    ],
)
def test_wrong_credentials_get_the_same_answer(client: TestClient, credentials: dict[str, str]) -> None:
    client.post("/api/v1/auth/sign-up", json=NEW_USER)
    client.cookies.clear()
    response = client.post("/api/v1/auth/sign-in", json=credentials)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"
