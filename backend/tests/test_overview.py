from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

NEW_USER = {"name": "Asha", "email": "asha@example.com", "password": "correct horse", "use_preset_categories": True}
URL = "/api/v1/overview"


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", _env_file=None))
    with TestClient(app) as test_client:
        test_client.post("/api/v1/auth/sign-up", json=NEW_USER)
        yield test_client


def _account(client: TestClient, name: str, currency: str = "INR") -> int:
    body = {"category": "savings", "name": name, "icon": "bank", "currency": currency}
    return client.post("/api/v1/accounts", json=body).json()["id"]


def _categories(client: TestClient) -> dict[str, int]:
    found = {}
    for top in client.get("/api/v1/categories").json():
        found[top["name"]] = top["id"]
        for sub in top["sub_categories"]:
            found[sub["name"]] = sub["id"]
    return found


@pytest.fixture
def seeded(client: TestClient) -> dict[str, int]:
    """October and November spending, a transfer (never counted) and a USD expense (another currency)."""
    bank = _account(client, "HDFC")
    wallet = _account(client, "Wallet")
    usd = _account(client, "Chase", "USD")
    cat = _categories(client)

    def add(kind: str, account: int, amount: int, when: str, category: str | None = None, **extra: object) -> None:
        body = {"type": kind, "account_id": account, "amount": amount, "occurred_at": when, **extra}
        if category:
            body["category_id"] = cat[category]
        assert client.post("/api/v1/transactions", json=body).status_code == 201

    add("income", bank, 8500000, "2026-11-01T10:00", "Salary Income")
    add("expense", bank, 30000, "2026-11-01T20:00", "Food")
    add("expense", wallet, 10000, "2026-11-03T09:00", "Drink")
    add("expense", bank, 60000, "2026-11-03T18:00", "Clothing")
    add("expense", usd, 999, "2026-11-03T18:00", "Food")
    add("transfer", bank, 50000, "2026-11-04T08:00", to_account_id=wallet)
    add("expense", bank, 70000, "2026-10-31T23:59", "Food")
    return cat


def test_totals(client: TestClient, seeded: dict[str, int]) -> None:
    response = client.get(f"{URL}/totals", params={"start": "2026-11-01", "end": "2026-11-30"})
    assert response.json() == {"start": "2026-11-01", "end": "2026-11-30", "income": 8500000, "expense": 100000}
    today = client.get(f"{URL}/totals", params={"start": "2026-11-03", "end": "2026-11-03"}).json()
    assert (today["income"], today["expense"]) == (0, 70000)


def test_daily_amounts_skip_empty_days(client: TestClient, seeded: dict[str, int]) -> None:
    days = client.get(f"{URL}/daily-amounts", params={"start": "2026-10-01", "end": "2026-11-30"}).json()
    assert days == [
        {"date": "2026-10-31", "income": 0, "expense": 70000},
        {"date": "2026-11-01", "income": 8500000, "expense": 30000},
        {"date": "2026-11-03", "income": 0, "expense": 70000},
    ]


def test_monthly_amounts_include_empty_months(client: TestClient, seeded: dict[str, int]) -> None:
    months = client.get(f"{URL}/monthly-amounts", params={"start_month": "2026-09", "end_month": "2026-12"}).json()
    assert months == [
        {"month": "2026-09", "income": 0, "expense": 0},
        {"month": "2026-10", "income": 0, "expense": 70000},
        {"month": "2026-11", "income": 8500000, "expense": 100000},
        {"month": "2026-12", "income": 0, "expense": 0},
    ]
    across_year = client.get(f"{URL}/monthly-amounts", params={"start_month": "2025-12", "end_month": "2026-01"}).json()
    assert [month["month"] for month in across_year] == ["2025-12", "2026-01"]


def test_expense_ranking_adds_sub_categories_into_groups(client: TestClient, seeded: dict[str, int]) -> None:
    ranking = client.get(f"{URL}/expense-ranking", params={"start": "2026-11-01", "end": "2026-11-30"}).json()
    assert ranking["total"] == 100000
    assert [(item["name"], item["amount"]) for item in ranking["items"]] == [
        ("Clothing & Appearance", 60000),
        ("Food & Drink", 40000),
    ]
    assert ranking["items"][0]["category_id"] == seeded["Clothing & Appearance"]
    assert ranking["items"][0]["percent"] == 60.0
    limited = client.get(f"{URL}/expense-ranking", params={"start": "2026-11-01", "end": "2026-11-30", "limit": 1})
    assert len(limited.json()["items"]) == 1


def test_empty_period(client: TestClient) -> None:
    ranking = client.get(f"{URL}/expense-ranking", params={"start": "2026-11-01", "end": "2026-11-30"}).json()
    assert (ranking["total"], ranking["items"]) == (0, [])


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("totals", {"start": "2026-11-30", "end": "2026-11-01"}),
        ("daily-amounts", {"start": "2025-01-01", "end": "2026-11-30"}),
        ("monthly-amounts", {"start_month": "2026-12", "end_month": "2026-01"}),
        ("monthly-amounts", {"start_month": "2020-01", "end_month": "2026-12"}),
        ("monthly-amounts", {"start_month": "2026-13", "end_month": "2026-12"}),
    ],
)
def test_ranges_are_checked(client: TestClient, path: str, params: dict[str, str]) -> None:
    assert client.get(f"{URL}/{path}", params=params).status_code == 422


def test_overview_needs_a_session(client: TestClient) -> None:
    client.cookies.clear()
    assert client.get(f"{URL}/totals", params={"start": "2026-11-01", "end": "2026-11-30"}).status_code == 401
