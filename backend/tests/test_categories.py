from collections.abc import Iterator
from pathlib import Path

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from app.categories.presets import PRESETS
from app.config import Settings
from app.main import create_app

NEW_USER = {"name": "Asha", "email": "asha@example.com", "password": "correct horse"}


@pytest.fixture
def db_url(tmp_path: Path) -> str:
    return f"sqlite:///{tmp_path / 'test.db'}"


@pytest.fixture
def client(db_url: str) -> Iterator[TestClient]:
    with TestClient(create_app(Settings(database_url=db_url, _env_file=None))) as test_client:
        yield test_client


def _categories(db_url: str) -> list[tuple]:
    engine = sa.create_engine(db_url)
    with engine.connect() as connection:
        rows = connection.execute(sa.text("SELECT type, parent_id, name, icon, color FROM categories ORDER BY id"))
        return [tuple(row) for row in rows]


def test_presets_are_public_and_grouped(client: TestClient) -> None:
    response = client.get("/api/v1/categories/presets")
    assert response.status_code == 200
    groups = response.json()
    assert [group["type"] for group in groups] == ["expense", "income", "transfer"]
    food = groups[0]["categories"][0]
    assert food["name"] == "Food & Drink"
    assert [sub["name"] for sub in food["sub_categories"]] == ["Food", "Drink", "Fruit & Snack"]


def test_sign_up_without_presets_has_no_categories(client: TestClient, db_url: str) -> None:
    assert client.post("/api/v1/auth/sign-up", json=NEW_USER).status_code == 201
    assert _categories(db_url) == []


def test_sign_up_with_presets_creates_them(client: TestClient, db_url: str) -> None:
    response = client.post("/api/v1/auth/sign-up", json={**NEW_USER, "use_preset_categories": True})
    assert response.status_code == 201

    rows = _categories(db_url)
    expected = sum(1 + len(preset.sub_categories) for presets in PRESETS.values() for preset in presets)
    assert len(rows) == expected
    tops = [row for row in rows if row[1] is None]
    assert [row[2] for row in tops if row[0] == "income"] == [
        "Occupational Earnings",
        "Finance & Investment",
        "Miscellaneous",
    ]
    assert ("expense", tops[0][1], "Food & Drink", "silverware-fork-knife", "#ff6b22") == tops[0]


def test_failed_sign_up_creates_no_categories(client: TestClient, db_url: str) -> None:
    client.post("/api/v1/auth/sign-up", json=NEW_USER)
    count = len(_categories(db_url))
    response = client.post("/api/v1/auth/sign-up", json={**NEW_USER, "use_preset_categories": True})
    assert response.status_code == 409
    assert len(_categories(db_url)) == count
