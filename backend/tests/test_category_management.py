from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

NEW_USER = {"name": "Asha", "email": "asha@example.com", "password": "correct horse"}
URL = "/api/v1/categories"


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", _env_file=None))
    with TestClient(app) as test_client:
        test_client.post("/api/v1/auth/sign-up", json=NEW_USER)
        yield test_client


def _create(client: TestClient, **fields: object) -> dict:
    response = client.post(URL, json={"type": "expense", "icon": "food", **fields})
    assert response.status_code == 201, response.text
    return response.json()


def _tree(client: TestClient) -> list[dict]:
    return client.get(URL).json()


def test_create_groups_and_sub_categories(client: TestClient) -> None:
    food = _create(client, name=" Food ", color="#FF6B22")
    assert (food["name"], food["color"], food["hidden"], food["parent_id"]) == ("Food", "#ff6b22", False, None)
    lunch = _create(client, name="Lunch", parent_id=food["id"])
    _create(client, name="Dinner", parent_id=food["id"])
    _create(client, name="Salary", type="income", icon="cash")

    tree = _tree(client)
    assert [(top["type"], top["name"]) for top in tree] == [("expense", "Food"), ("income", "Salary")]
    assert [sub["name"] for sub in tree[0]["sub_categories"]] == ["Lunch", "Dinner"]
    assert lunch["parent_id"] == food["id"]


@pytest.mark.parametrize(
    ("fields", "field"),
    [
        ({"name": "  "}, "name"),
        ({"name": "x" * 65}, "name"),
        ({"name": "Ok", "icon": "Not An Icon"}, "icon"),
        ({"name": "Ok", "color": "red"}, "color"),
        ({"name": "Ok", "type": "gift"}, "type"),
    ],
)
def test_create_validates_fields(client: TestClient, fields: dict, field: str) -> None:
    response = client.post(URL, json={"type": "expense", "icon": "food", **fields})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field


def test_sub_categories_go_one_level_deep_in_the_same_type(client: TestClient) -> None:
    food = _create(client, name="Food")
    lunch = _create(client, name="Lunch", parent_id=food["id"])
    salary = _create(client, name="Salary", type="income")
    for parent, message in [(lunch["id"], "top-level"), (salary["id"], "expense"), (9999, "your categories")]:
        response = client.post(URL, json={"type": "expense", "icon": "food", "name": "X", "parent_id": parent})
        assert response.status_code == 422
        assert message in response.json()["error"]["message"]


def test_update_renames_hides_and_moves(client: TestClient) -> None:
    food = _create(client, name="Food")
    drinks = _create(client, name="Drinks")
    _create(client, name="Earlier", parent_id=drinks["id"])
    lunch = _create(client, name="Lunch", parent_id=food["id"])

    response = client.patch(f"{URL}/{lunch['id']}", json={"name": "Meals", "hidden": True, "color": None})
    assert response.status_code == 200
    assert (response.json()["name"], response.json()["hidden"]) == ("Meals", True)

    moved = client.patch(f"{URL}/{lunch['id']}", json={"parent_id": drinks["id"]}).json()
    assert moved["parent_id"] == drinks["id"]
    assert moved["display_order"] == 1  # last in its new group


def test_update_refuses_what_would_break_the_tree(client: TestClient) -> None:
    food = _create(client, name="Food")
    drinks = _create(client, name="Drinks")
    lunch = _create(client, name="Lunch", parent_id=food["id"])
    assert client.patch(f"{URL}/{food['id']}", json={"parent_id": drinks["id"]}).status_code == 422
    assert client.patch(f"{URL}/{lunch['id']}", json={"parent_id": None}).status_code == 422
    assert client.patch(f"{URL}/{lunch['id']}", json={"name": None}).status_code == 422


def test_delete_a_group_deletes_its_sub_categories(client: TestClient) -> None:
    food = _create(client, name="Food")
    _create(client, name="Lunch", parent_id=food["id"])
    assert client.delete(f"{URL}/{food['id']}").status_code == 204
    assert _tree(client) == []


def test_categories_with_transactions_cannot_be_deleted(client: TestClient) -> None:
    food = _create(client, name="Food")
    lunch = _create(client, name="Lunch", parent_id=food["id"])
    account = client.post(
        "/api/v1/accounts", json={"category": "cash", "name": "Wallet", "icon": "wallet", "currency": "INR"}
    ).json()
    body = {"type": "expense", "account_id": account["id"], "category_id": lunch["id"], "amount": 100}
    assert client.post("/api/v1/transactions", json={**body, "occurred_at": "2026-11-10T10:00"}).status_code == 201

    assert _tree(client)[0]["sub_categories"][0]["transaction_count"] == 1
    for target in (lunch, food):  # the group is refused too, as deleting it would delete Lunch
        response = client.delete(f"{URL}/{target['id']}")
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "category_in_use"


def test_reorder_top_level_and_sub_categories(client: TestClient) -> None:
    food = _create(client, name="Food")
    rent = _create(client, name="Rent")
    lunch = _create(client, name="Lunch", parent_id=food["id"])
    dinner = _create(client, name="Dinner", parent_id=food["id"])

    tree = client.put(f"{URL}/order", json={"type": "expense", "ids": [rent["id"], food["id"]]}).json()
    assert [top["name"] for top in tree] == ["Rent", "Food"]
    body = {"type": "expense", "parent_id": food["id"], "ids": [dinner["id"], lunch["id"]]}
    tree = client.put(f"{URL}/order", json=body).json()
    assert [sub["name"] for sub in tree[1]["sub_categories"]] == ["Dinner", "Lunch"]

    partial = client.put(f"{URL}/order", json={"type": "expense", "ids": [rent["id"]]})
    assert partial.status_code == 422
    assert partial.json()["error"]["code"] == "order_mismatch"


def test_users_cannot_touch_each_others_categories(client: TestClient) -> None:
    food = _create(client, name="Food")
    client.cookies.clear()
    client.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "ravi@example.com"})
    assert client.patch(f"{URL}/{food['id']}", json={"name": "Mine"}).status_code == 404
    assert client.delete(f"{URL}/{food['id']}").status_code == 404
    assert (
        client.post(URL, json={"type": "expense", "icon": "food", "name": "X", "parent_id": food["id"]}).status_code
        == 422
    )
    assert client.put(f"{URL}/order", json={"type": "expense", "ids": [food["id"]]}).status_code == 422
