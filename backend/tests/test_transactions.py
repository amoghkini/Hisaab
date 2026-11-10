from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

NEW_USER = {"name": "Asha", "email": "asha@example.com", "password": "correct horse", "use_preset_categories": True}
URL = "/api/v1/transactions"
NOVEMBER = {"start": "2026-11-01", "end": "2026-11-30"}


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", _env_file=None))
    with TestClient(app) as test_client:
        test_client.post("/api/v1/auth/sign-up", json=NEW_USER)
        yield test_client


def _account(client: TestClient, name: str, opening: int = 0, currency: str = "INR", category: str = "savings") -> int:
    body = {"category": category, "name": name, "icon": "bank", "currency": currency, "opening_balance": opening}
    response = client.post("/api/v1/accounts", json=body)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _category(client: TestClient, kind: str, name: str) -> int:
    for top in client.get("/api/v1/categories").json():
        if top["type"] != kind:
            continue
        for sub in top["sub_categories"]:
            if sub["name"] == name:
                return sub["id"]
    raise AssertionError(f"no {kind} category {name}")


def _top_category(client: TestClient, kind: str) -> int:
    return next(top["id"] for top in client.get("/api/v1/categories").json() if top["type"] == kind)


def _add(client: TestClient, **fields: object) -> dict:
    response = client.post(URL, json={"occurred_at": "2026-11-10T09:30", "comment": "", **fields})
    assert response.status_code == 201, response.text
    return response.json()


def _balance(client: TestClient, account_id: int) -> int:
    return client.get(f"/api/v1/accounts/{account_id}").json()["balance"]


def test_categories_list_is_a_tree_in_type_order(client: TestClient) -> None:
    tops = client.get("/api/v1/categories").json()
    assert [top["type"] for top in tops][0] == "expense"
    assert [top["type"] for top in tops][-1] == "transfer"
    food = tops[0]
    assert food["name"] == "Food & Drink"
    assert [sub["name"] for sub in food["sub_categories"]] == ["Food", "Drink", "Fruit & Snack"]
    assert all(sub["parent_id"] == food["id"] for sub in food["sub_categories"])


def test_presets_can_be_added_once_by_users_without_categories(client: TestClient) -> None:
    assert client.post("/api/v1/categories/presets").status_code == 409
    client.cookies.clear()
    client.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "ravi@example.com", "use_preset_categories": False})
    assert client.get("/api/v1/categories").json() == []
    response = client.post("/api/v1/categories/presets")
    assert response.status_code == 201
    assert len(response.json()) > 0
    assert client.post("/api/v1/categories/presets").status_code == 409


def test_expense_and_income_move_the_balance(client: TestClient) -> None:
    bank = _account(client, "HDFC", 1000000)
    _add(client, type="expense", account_id=bank, amount=25000, category_id=_category(client, "expense", "Food"))
    _add(
        client, type="income", account_id=bank, amount=500000, category_id=_category(client, "income", "Salary Income")
    )
    assert _balance(client, bank) == 1000000 - 25000 + 500000


def test_transfer_moves_money_between_accounts(client: TestClient) -> None:
    bank = _account(client, "HDFC", 1000000)
    card = _account(client, "Card", -300000, category="credit_card")
    sent = _add(client, type="transfer", account_id=bank, to_account_id=card, amount=300000, to_amount=1)
    assert sent["to_amount"] == 300000  # same currency: what arrives is what was sent
    assert sent["category_id"] is None
    assert _balance(client, bank) == 700000
    assert _balance(client, card) == 0


def test_transfer_between_currencies_needs_the_amount_that_arrives(client: TestClient) -> None:
    inr = _account(client, "HDFC", 1000000)
    usd = _account(client, "Chase", 0, currency="USD")
    body = {
        "type": "transfer",
        "account_id": inr,
        "to_account_id": usd,
        "amount": 850000,
        "occurred_at": "2026-11-10T10:00",
    }
    response = client.post(URL, json=body)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "to_amount"
    _add(client, **{**body, "to_amount": 10000})
    assert (_balance(client, inr), _balance(client, usd)) == (150000, 10000)


@pytest.mark.parametrize(
    ("change", "field"),
    [
        ({"category_id": None}, "category_id"),
        ({"amount": 0}, "amount"),
        ({"amount": -5}, "amount"),
        ({"type": "lend"}, "type"),
        ({"occurred_at": "yesterday"}, "occurred_at"),
        ({"comment": "x" * 256}, "comment"),
    ],
)
def test_input_is_checked(client: TestClient, change: dict, field: str) -> None:
    bank = _account(client, "HDFC")
    body = {
        "type": "expense",
        "account_id": bank,
        "amount": 100,
        "category_id": _category(client, "expense", "Food"),
        "occurred_at": "2026-11-10T09:30",
        **change,
    }
    response = client.post(URL, json=body)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field


def test_category_must_match_the_type_and_be_a_sub_category(client: TestClient) -> None:
    bank = _account(client, "HDFC")
    base = {"type": "expense", "account_id": bank, "amount": 100, "occurred_at": "2026-11-10T09:30"}
    wrong_type = client.post(URL, json={**base, "category_id": _category(client, "income", "Salary Income")})
    assert wrong_type.status_code == 422
    assert wrong_type.json()["error"]["message"] == "Choose an expense category."
    group = client.post(URL, json={**base, "category_id": _top_category(client, "expense")})
    assert group.status_code == 422
    assert group.json()["error"]["message"] == "Choose a sub-category."


def test_transfer_needs_a_different_account(client: TestClient) -> None:
    bank = _account(client, "HDFC")
    base = {"type": "transfer", "account_id": bank, "amount": 100, "occurred_at": "2026-11-10T09:30"}
    assert client.post(URL, json=base).json()["error"]["details"][0]["field"] == "to_account_id"
    same = client.post(URL, json={**base, "to_account_id": bank})
    assert same.json()["error"]["details"][0]["field"] == "to_account_id"


def test_list_filters_and_totals(client: TestClient) -> None:
    bank = _account(client, "HDFC", 1000000)
    wallet = _account(client, "Wallet", 50000, category="cash")
    usd = _account(client, "Chase", 0, currency="USD")
    food = _category(client, "expense", "Food")
    _add(client, type="expense", account_id=bank, amount=25000, category_id=food, comment="Lunch at office")
    _add(client, type="expense", account_id=wallet, amount=4000, category_id=food, occurred_at="2026-11-12T20:00")
    _add(client, type="expense", account_id=usd, amount=999, category_id=food)  # another currency: not in totals
    _add(
        client, type="income", account_id=bank, amount=800000, category_id=_category(client, "income", "Salary Income")
    )
    _add(client, type="expense", account_id=bank, amount=1, category_id=food, occurred_at="2026-10-31T23:59")
    _add(client, type="transfer", account_id=bank, to_account_id=wallet, amount=10000)

    listed = client.get(URL, params=NOVEMBER).json()
    assert len(listed["items"]) == 5
    assert listed["items"][0]["occurred_at"] == "2026-11-12T20:00:00"  # newest first
    assert (listed["total_income"], listed["total_expense"]) == (800000, 29000)

    def count(**params: object) -> int:
        return len(client.get(URL, params={**NOVEMBER, **params}).json()["items"])

    assert count(type="expense") == 3
    assert count(account_id=wallet) == 2  # its expense, and the transfer into it
    assert count(category_id=_top_category(client, "expense")) == 3  # a group matches its sub-categories
    assert count(q="office") == 1
    assert count(q="%") == 0


def test_list_range_is_checked(client: TestClient) -> None:
    assert client.get(URL, params={"start": "2026-11-30", "end": "2026-11-01"}).status_code == 422
    assert client.get(URL, params={"start": "2025-01-01", "end": "2026-11-01"}).status_code == 422


def test_replace_and_delete(client: TestClient) -> None:
    bank = _account(client, "HDFC", 1000000)
    wallet = _account(client, "Wallet", 0, category="cash")
    added = _add(
        client, type="expense", account_id=bank, amount=25000, category_id=_category(client, "expense", "Food")
    )
    response = client.put(
        f"{URL}/{added['id']}",
        json={
            "type": "transfer",
            "account_id": bank,
            "to_account_id": wallet,
            "amount": 5000,
            "occurred_at": "2026-11-11T08:00",
        },
    )
    assert response.status_code == 200
    assert response.json()["type"] == "transfer"
    assert (_balance(client, bank), _balance(client, wallet)) == (995000, 5000)

    assert client.delete(f"{URL}/{added['id']}").status_code == 204
    assert _balance(client, bank) == 1000000
    assert client.get(f"{URL}/{added['id']}").status_code == 404


def test_account_with_transactions_cannot_be_deleted_or_change_currency(client: TestClient) -> None:
    bank = _account(client, "HDFC", 1000000)
    _add(client, type="expense", account_id=bank, amount=100, category_id=_category(client, "expense", "Food"))
    deleted = client.delete(f"/api/v1/accounts/{bank}")
    assert deleted.status_code == 409
    assert deleted.json()["error"]["code"] == "account_in_use"
    changed = client.patch(f"/api/v1/accounts/{bank}", json={"currency": "USD"})
    assert changed.status_code == 409
    assert changed.json()["error"]["code"] == "currency_locked"
    assert client.patch(f"/api/v1/accounts/{bank}", json={"currency": "INR", "name": "HDFC 2"}).status_code == 200


def test_summary_counts_transactions(client: TestClient) -> None:
    bank = _account(client, "HDFC", 1000000)
    card = _account(client, "Card", 0, category="credit_card")
    _add(client, type="expense", account_id=card, amount=200000, category_id=_category(client, "expense", "Food"))
    summary = client.get("/api/v1/accounts/summary").json()
    assert (summary["total_assets"], summary["total_liabilities"], summary["net_assets"]) == (1000000, 200000, 800000)
    assert bank


def test_users_cannot_use_each_others_accounts_or_transactions(client: TestClient) -> None:
    bank = _account(client, "HDFC", 1000000)
    food = _category(client, "expense", "Food")
    mine = _add(client, type="expense", account_id=bank, amount=100, category_id=food)

    client.cookies.clear()
    client.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "ravi@example.com"})
    own = _account(client, "Ravi's")
    assert client.get(URL, params=NOVEMBER).json()["items"] == []
    assert client.get(f"{URL}/{mine['id']}").status_code == 404
    assert client.delete(f"{URL}/{mine['id']}").status_code == 404
    base = {"type": "expense", "amount": 100, "occurred_at": "2026-11-10T09:30"}
    stolen_account = client.post(
        URL, json={**base, "account_id": bank, "category_id": _category(client, "expense", "Food")}
    )
    assert stolen_account.json()["error"]["details"][0]["field"] == "account_id"
    stolen_category = client.post(URL, json={**base, "account_id": own, "category_id": food})
    assert stolen_category.json()["error"]["details"][0]["field"] == "category_id"


def test_list_filters_by_several_accounts_and_categories_amount_and_pages(client: TestClient) -> None:
    bank = _account(client, "Bank")
    card = _account(client, "Card", category="credit_card")
    other = _account(client, "Other")
    food = _category(client, "expense", "Food")
    for account, cents in [(bank, 10_000), (card, 50_000), (other, 90_000)]:
        _add(client, type="expense", account_id=account, category_id=food, amount=cents, occurred_at="2026-11-05T10:00")

    def amounts(**params: object) -> list[int]:
        response = client.get(URL, params={**NOVEMBER, **params})
        assert response.status_code == 200, response.text
        return sorted(item["amount"] for item in response.json()["items"])

    assert amounts(account_id=[bank, card]) == [10_000, 50_000]
    assert amounts(category_id=[food]) == [10_000, 50_000, 90_000]
    assert amounts(amount="gt:10000") == [50_000, 90_000]
    assert amounts(amount="lt:50000") == [10_000]
    assert amounts(amount="eq:50000") == [50_000]
    assert amounts(amount="ne:50000") == [10_000, 90_000]
    assert amounts(amount="bt:90000:10000") == [10_000, 50_000, 90_000]
    assert amounts(amount="nb:20000:60000") == [10_000, 90_000]
    assert client.get(URL, params={**NOVEMBER, "amount": "gt:abc"}).status_code == 422

    page = client.get(URL, params={**NOVEMBER, "limit": 2, "offset": 2}).json()
    assert len(page["items"]) == 1
    assert page["total_count"] == 3
    assert page["total_expense"] == 150_000


def test_daily_totals_cover_every_match_across_pages(client: TestClient) -> None:
    bank = _account(client, "Bank")
    dollars = _account(client, "US Bank", currency="USD")
    salary = _category(client, "income", "Salary Income")
    food = _category(client, "expense", "Food")
    for hour in (9, 10, 11):
        _add(
            client, type="expense", account_id=bank, category_id=food, amount=1_000, occurred_at=f"2026-11-05T{hour:02d}:00"
        )
    _add(client, type="income", account_id=bank, category_id=salary, amount=50_000, occurred_at="2026-11-05T08:00")
    _add(client, type="expense", account_id=dollars, category_id=food, amount=700, occurred_at="2026-11-05T12:00")
    _add(client, type="expense", account_id=bank, category_id=food, amount=2_000, occurred_at="2026-11-03T12:00")

    # A page of two splits 5 November; its totals still count the whole day.
    assert len(client.get(URL, params={**NOVEMBER, "limit": 2}).json()["items"]) == 2
    response = client.get(f"{URL}/daily-totals", params=NOVEMBER)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["currency"] == "INR"
    assert body["days"] == [
        {"day": "2026-11-05", "income": 50_000, "expense": 3_000, "count": 5},
        {"day": "2026-11-03", "income": 0, "expense": 2_000, "count": 1},
    ]

    # The same filters as the list.
    filtered = client.get(f"{URL}/daily-totals", params={**NOVEMBER, "type": "expense", "amount": "gt:1500"}).json()
    assert filtered["days"] == [{"day": "2026-11-03", "income": 0, "expense": 2_000, "count": 1}]
    assert client.get(f"{URL}/daily-totals", params={"start": "2026-11-30", "end": "2026-11-01"}).status_code == 422


def test_list_filters_by_several_types(client: TestClient) -> None:
    bank = _account(client, "Bank")
    cash = _account(client, "Cash", category="cash")
    _add(client, type="expense", account_id=bank, category_id=_category(client, "expense", "Food"), amount=100)
    _add(client, type="income", account_id=bank, category_id=_category(client, "income", "Salary Income"), amount=200)
    _add(client, type="transfer", account_id=bank, to_account_id=cash, amount=300)

    def types(*kinds: str) -> list[str]:
        return sorted(
            item["type"] for item in client.get(URL, params={**NOVEMBER, "type": list(kinds)}).json()["items"]
        )

    assert types("expense", "income") == ["expense", "income"]
    assert types("transfer") == ["transfer"]
    assert types() == ["expense", "income", "transfer"]
    assert client.get(URL, params={**NOVEMBER, "type": "refund"}).status_code == 422
