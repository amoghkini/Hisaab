from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

NEW_USER = {"name": "Asha", "email": "asha@example.com", "password": "correct horse"}
URL = "/api/v1/accounts"
SAVINGS = {"category": "savings", "name": "HDFC Savings", "icon": "bank", "currency": "INR", "opening_balance": 5000000}
CARD = {"category": "credit_card", "name": "ICICI Amazon Pay", "icon": "credit-card", "currency": "INR"}


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", _env_file=None))
    with TestClient(app) as test_client:
        test_client.post("/api/v1/auth/sign-up", json=NEW_USER)
        yield test_client


def _create(client: TestClient, **fields: object) -> dict:
    response = client.post(URL, json=fields)
    assert response.status_code == 201, response.text
    return response.json()


def test_new_user_has_no_accounts(client: TestClient) -> None:
    assert client.get(URL).json() == []


def test_create_and_list(client: TestClient) -> None:
    created = _create(client, **SAVINGS, number_suffix="1234", comment="  salary account ")
    assert created["name"] == "HDFC Savings"
    assert created["balance"] == 5000000
    assert created["is_liability"] is False
    assert created["comment"] == "salary account"
    assert created["hidden"] is False
    assert created["include_in_total"] is True
    assert client.get(URL).json() == [created]
    assert client.get(f"{URL}/{created['id']}").json() == created


def test_list_is_by_category_then_order(client: TestClient) -> None:
    card = _create(client, **CARD)
    second = _create(client, **{**SAVINGS, "name": "SBI"})
    cash = _create(client, category="cash", name="Wallet", icon="wallet", currency="INR")
    first_savings = _create(client, **SAVINGS)
    names = [account["name"] for account in client.get(URL).json()]
    assert names == [cash["name"], second["name"], first_savings["name"], card["name"]]


def test_card_fields_are_kept_for_cards_only(client: TestClient) -> None:
    card = _create(client, **CARD, credit_limit=20000000, statement_day=15, opening_balance=-1250000)
    assert (card["credit_limit"], card["statement_day"], card["is_liability"]) == (20000000, 15, True)

    savings = _create(client, **SAVINGS, credit_limit=100, statement_day=3)
    assert (savings["credit_limit"], savings["statement_day"]) == (None, None)

    moved = client.patch(f"{URL}/{card['id']}", json={"category": "loan"}).json()
    assert (moved["credit_limit"], moved["statement_day"], moved["is_liability"]) == (None, None, True)


def test_update_changes_only_fields_sent(client: TestClient) -> None:
    created = _create(client, **SAVINGS, color="#2196F3", number_suffix="1234")
    response = client.patch(f"{URL}/{created['id']}", json={"name": " HDFC ", "hidden": True})
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "HDFC"
    assert updated["hidden"] is True
    assert updated["color"] == "#2196f3"
    assert updated["number_suffix"] == "1234"


def test_update_can_clear_optional_fields(client: TestClient) -> None:
    created = _create(client, **SAVINGS, color="#2196f3", number_suffix="1234")
    updated = client.patch(f"{URL}/{created['id']}", json={"color": None, "number_suffix": None}).json()
    assert (updated["color"], updated["number_suffix"]) == (None, None)


@pytest.mark.parametrize("field", ["name", "category", "currency", "opening_balance", "hidden"])
def test_update_refuses_null_for_required_fields(client: TestClient, field: str) -> None:
    created = _create(client, **SAVINGS)
    response = client.patch(f"{URL}/{created['id']}", json={field: None})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", "   "),
        ("category", "piggy_bank"),
        ("currency", "RUPEE"),
        ("icon", "Bank Icon"),
        ("color", "blue"),
        ("number_suffix", "12ab"),
        ("statement_day", 32),
        ("credit_limit", -1),
        ("opening_balance", 10**16),
    ],
)
def test_create_validates_fields(client: TestClient, field: str, value: object) -> None:
    response = client.post(URL, json={**CARD, field: value})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field


def test_changing_category_puts_it_last(client: TestClient) -> None:
    _create(client, **SAVINGS)
    cash = _create(client, category="cash", name="Wallet", icon="wallet", currency="INR")
    moved = client.patch(f"{URL}/{cash['id']}", json={"category": "savings"}).json()
    assert moved["display_order"] == 1


def test_delete(client: TestClient) -> None:
    created = _create(client, **SAVINGS)
    assert client.delete(f"{URL}/{created['id']}").status_code == 204
    assert client.get(URL).json() == []
    assert client.delete(f"{URL}/{created['id']}").status_code == 404


def test_reorder(client: TestClient) -> None:
    first = _create(client, **SAVINGS)
    second = _create(client, **{**SAVINGS, "name": "SBI"})
    response = client.put(f"{URL}/order/savings", json={"ids": [second["id"], first["id"]]})
    assert response.status_code == 200
    assert [account["id"] for account in response.json()] == [second["id"], first["id"]]


@pytest.mark.parametrize("ids", [[1], [1, 1, 2], [1, 2, 99]])
def test_reorder_must_list_each_account_once(client: TestClient, ids: list[int]) -> None:
    _create(client, **SAVINGS)
    _create(client, **{**SAVINGS, "name": "SBI"})
    response = client.put(f"{URL}/order/savings", json={"ids": ids})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "order_mismatch"


def test_summary(client: TestClient) -> None:
    _create(client, **SAVINGS)  # 50,000
    _create(client, **CARD, opening_balance=-1250000)  # owes 12,500
    old = _create(client, **{**SAVINGS, "name": "Old", "opening_balance": 100000})
    _create(client, **{**SAVINGS, "name": "Shared", "opening_balance": 900000, "include_in_total": False})
    _create(client, **{**SAVINGS, "name": "Chase", "currency": "USD", "opening_balance": 50000})
    client.patch(f"{URL}/{old['id']}", json={"hidden": True})  # hidden still counts, but not in account_count

    summary = client.get(f"{URL}/summary").json()
    assert summary == {
        "currency": "INR",
        "account_count": 4,
        "total_assets": 5100000,
        "total_liabilities": 1250000,
        "net_assets": 3850000,
        "other_currencies": ["USD"],
    }


def test_accounts_need_a_session(client: TestClient) -> None:
    client.cookies.clear()
    assert client.get(URL).status_code == 401
    assert client.post(URL, json=SAVINGS).status_code == 401


def test_users_cannot_see_each_others_accounts(client: TestClient) -> None:
    mine = _create(client, **SAVINGS)
    client.cookies.clear()
    client.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "ravi@example.com"})
    assert client.get(URL).json() == []
    assert client.get(f"{URL}/{mine['id']}").status_code == 404
    assert client.patch(f"{URL}/{mine['id']}", json={"name": "Mine now"}).status_code == 404
    assert client.delete(f"{URL}/{mine['id']}").status_code == 404
    assert client.put(f"{URL}/order/savings", json={"ids": [mine["id"]]}).status_code == 422
