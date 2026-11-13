"""The settings pages: profile, password, sessions, and data management."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

NEW_USER = {"name": "Asha", "email": "asha@example.com", "password": "correct horse"}
ME = "/api/v1/auth/me"
SESSIONS = "/api/v1/auth/sessions"
SAVINGS = {"category": "savings", "name": "HDFC Savings", "icon": "bank", "currency": "INR"}


@pytest.fixture
def app_settings(tmp_path: Path) -> Settings:
    return Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", _env_file=None)


@pytest.fixture
def client(app_settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(app_settings), headers={"User-Agent": "Laptop Firefox"}) as test_client:
        test_client.post("/api/v1/auth/sign-up", json=NEW_USER)
        yield test_client


def _second_device(client: TestClient) -> TestClient:
    """Another browser signed in to the same account, sharing the app."""
    other = TestClient(client.app, headers={"User-Agent": "Phone Chrome"})
    assert other.post("/api/v1/auth/sign-in", json=NEW_USER).status_code == 200
    return other


def _account(client: TestClient) -> int:
    response = client.post("/api/v1/accounts", json=SAVINGS)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_new_settings_have_defaults(client: TestClient) -> None:
    me = client.get(ME).json()
    assert (me["default_account_id"], me["salary_account_id"]) == (None, None)
    assert me["fiscal_year_start_month"] == 4
    assert (me["digit_grouping"], me["currency_display"]) == ("indian", "symbol")
    assert me["created_at"]


def test_name_can_be_changed(client: TestClient) -> None:
    assert client.patch(ME, json={"name": "  Asha Rao "}).json()["name"] == "Asha Rao"


@pytest.mark.parametrize("email", ["asha.rao@example.com", "asha@example.com"])
def test_email_cannot_be_changed(client: TestClient, email: str) -> None:
    response = client.patch(ME, json={"name": "Asha Rao", "email": email})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "email"
    me = client.get(ME).json()
    assert (me["name"], me["email"]) == ("Asha", "asha@example.com")  # nothing in the refused request was saved


@pytest.mark.parametrize(
    ("field", "bad"),
    [
        ("name", "   "),
        ("name", None),
        ("fiscal_year_start_month", 13),
        ("fiscal_year_start_month", 0),
        ("digit_grouping", "chinese"),
        ("currency_display", None),
    ],
)
def test_bad_settings_are_refused(client: TestClient, field: str, bad: object) -> None:
    response = client.patch(ME, json={field: bad})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field


def test_display_settings_are_saved(client: TestClient) -> None:
    changes = {"fiscal_year_start_month": 1, "digit_grouping": "international", "currency_display": "code"}
    me = client.patch(ME, json=changes).json()
    assert {key: me[key] for key in changes} == changes


def test_default_account_is_set_cleared_and_forgotten_with_the_account(client: TestClient) -> None:
    account_id = _account(client)
    assert client.patch(ME, json={"default_account_id": account_id}).json()["default_account_id"] == account_id
    assert client.patch(ME, json={"default_account_id": None}).json()["default_account_id"] is None

    client.patch(ME, json={"default_account_id": account_id})
    assert client.delete(f"/api/v1/accounts/{account_id}").status_code == 204
    assert client.get(ME).json()["default_account_id"] is None


def test_default_account_must_be_ones_own(client: TestClient) -> None:
    other = TestClient(client.app)
    other.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "ravi@example.com"})
    theirs = _account(other)
    for bad in (theirs, 99999):
        response = client.patch(ME, json={"default_account_id": bad})
        assert response.status_code == 422
        assert response.json()["error"]["details"][0]["field"] == "default_account_id"


def test_salary_account_is_set_cleared_and_forgotten_with_the_account(client: TestClient) -> None:
    assert client.get(ME).json()["salary_account_id"] is None
    account_id = _account(client)
    assert client.patch(ME, json={"salary_account_id": account_id}).json()["salary_account_id"] == account_id
    assert client.patch(ME, json={"salary_account_id": None}).json()["salary_account_id"] is None

    client.patch(ME, json={"salary_account_id": account_id})
    assert client.delete(f"/api/v1/accounts/{account_id}").status_code == 204
    assert client.get(ME).json()["salary_account_id"] is None


def test_salary_account_must_be_ones_own_savings_or_current_account(client: TestClient) -> None:
    other = TestClient(client.app)
    other.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "ravi@example.com"})
    theirs = _account(other)
    card = client.post("/api/v1/accounts", json={**SAVINGS, "category": "credit_card", "name": "Card"}).json()["id"]
    for bad in (theirs, 99999, card):
        response = client.patch(ME, json={"salary_account_id": bad})
        assert response.status_code == 422
        assert response.json()["error"]["details"][0]["field"] == "salary_account_id"

    current = client.post("/api/v1/accounts", json={**SAVINGS, "category": "current", "name": "Current"}).json()["id"]
    assert client.patch(ME, json={"salary_account_id": current}).json()["salary_account_id"] == current


def test_salary_account_is_forgotten_when_it_stops_being_savings_or_current(client: TestClient) -> None:
    account_id = _account(client)
    client.patch(ME, json={"salary_account_id": account_id})
    assert client.patch(f"/api/v1/accounts/{account_id}", json={"category": "current"}).status_code == 200
    assert client.get(ME).json()["salary_account_id"] == account_id  # still a place a salary can go

    assert client.patch(f"/api/v1/accounts/{account_id}", json={"category": "wallet"}).status_code == 200
    assert client.get(ME).json()["salary_account_id"] is None


def test_sessions_list_each_device_and_mark_this_one(client: TestClient) -> None:
    _second_device(client)
    sessions = client.get(SESSIONS).json()
    assert len(sessions) == 2
    assert {item["user_agent"] for item in sessions} == {"Laptop Firefox", "Phone Chrome"}
    assert [item["user_agent"] for item in sessions if item["current"]] == ["Laptop Firefox"]
    assert all(item["last_seen_at"] for item in sessions)


def test_one_device_can_be_signed_out(client: TestClient) -> None:
    phone = _second_device(client)
    phone_session = next(item for item in client.get(SESSIONS).json() if not item["current"])
    assert client.delete(f"{SESSIONS}/{phone_session['id']}").status_code == 204
    assert phone.get(ME).status_code == 401
    assert client.get(ME).status_code == 200
    assert client.delete(f"{SESSIONS}/{phone_session['id']}").status_code == 404


def test_cannot_sign_out_someone_elses_session(client: TestClient) -> None:
    other = TestClient(client.app)
    other.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "ravi@example.com"})
    theirs = other.get(SESSIONS).json()[0]["id"]
    assert client.delete(f"{SESSIONS}/{theirs}").status_code == 404
    assert other.get(ME).status_code == 200


def test_sign_out_all_other_devices(client: TestClient) -> None:
    phone = _second_device(client)
    assert client.delete(SESSIONS).status_code == 204
    assert phone.get(ME).status_code == 401
    assert [item["current"] for item in client.get(SESSIONS).json()] == [True]


def test_password_change_signs_out_other_devices(client: TestClient) -> None:
    phone = _second_device(client)
    change = {"current_password": "correct horse", "new_password": "battery staple"}
    assert client.post(f"{ME}/password", json=change).status_code == 204
    assert client.get(ME).status_code == 200
    assert phone.get(ME).status_code == 401
    assert phone.post("/api/v1/auth/sign-in", json=NEW_USER).status_code == 401
    assert phone.post("/api/v1/auth/sign-in", json={**NEW_USER, "password": "battery staple"}).status_code == 200


def test_password_change_needs_the_current_password(client: TestClient) -> None:
    response = client.post(f"{ME}/password", json={"current_password": "wrong", "new_password": "battery staple"})
    assert response.status_code == 400
    assert response.json()["error"]["details"][0]["field"] == "current_password"
    short = client.post(f"{ME}/password", json={"current_password": "correct horse", "new_password": "short"})
    assert short.status_code == 422


def _add_data(client: TestClient) -> int:
    account_id = _account(client)
    categories = client.post("/api/v1/categories/presets").json()
    income = next(group for group in categories if group["type"] == "income")
    salary = income["sub_categories"][0]["id"]
    for day in ("2025-03-02T10:00:00", "2026-11-01T09:30:00"):
        response = client.post(
            "/api/v1/transactions",
            json={
                "type": "income",
                "occurred_at": day,
                "account_id": account_id,
                "category_id": salary,
                "amount": 1000,
            },
        )
        assert response.status_code == 201, response.text
    return account_id


def test_data_stats(client: TestClient) -> None:
    empty = client.get("/api/v1/data/stats").json()
    assert empty == {
        "accounts": 0,
        "categories": 0,
        "transactions": 0,
        "first_transaction_on": None,
        "last_transaction_on": None,
    }
    _add_data(client)
    stats = client.get("/api/v1/data/stats").json()
    assert (stats["accounts"], stats["transactions"]) == (1, 2)
    assert stats["categories"] > 0
    assert (stats["first_transaction_on"], stats["last_transaction_on"]) == ("2025-03-02", "2026-11-01")


def test_clear_transactions_keeps_accounts_and_categories(client: TestClient) -> None:
    _add_data(client)
    response = client.post("/api/v1/data/clear", json={"scope": "transactions", "password": "correct horse"})
    assert response.status_code == 204
    stats = client.get("/api/v1/data/stats").json()
    assert (stats["accounts"], stats["transactions"]) == (1, 0)
    assert stats["categories"] > 0


def test_clear_all_data(client: TestClient) -> None:
    account_id = _add_data(client)
    client.patch(ME, json={"default_account_id": account_id, "salary_account_id": account_id})
    assert client.post("/api/v1/data/clear", json={"scope": "all", "password": "correct horse"}).status_code == 204
    stats = client.get("/api/v1/data/stats").json()
    assert (stats["accounts"], stats["categories"], stats["transactions"]) == (0, 0, 0)
    me = client.get(ME).json()
    assert (me["default_account_id"], me["salary_account_id"]) == (None, None)


def test_clear_needs_the_password_and_leaves_others_alone(client: TestClient) -> None:
    other = TestClient(client.app)
    other.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "ravi@example.com"})
    _add_data(other)
    _add_data(client)

    wrong = client.post("/api/v1/data/clear", json={"scope": "all", "password": "nope"})
    assert wrong.status_code == 400
    assert wrong.json()["error"]["details"][0]["field"] == "password"
    assert client.get("/api/v1/data/stats").json()["transactions"] == 2

    client.post("/api/v1/data/clear", json={"scope": "all", "password": "correct horse"})
    assert other.get("/api/v1/data/stats").json()["transactions"] == 2
