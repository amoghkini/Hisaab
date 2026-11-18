"""Payslips: drafted on pay day, pre-filled, edited, approved into the ledger, and dismissed.

The pay-day job is off here; tests run it with a fixed "today", and set when the employer was added, so the
months drafted never depend on the real date.
"""

from collections.abc import Iterator
from datetime import date, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.config import Settings
from app.main import create_app
from app.salary.jobs import _run_once
from app.salary.models import Employer
from app.salary.payslips import generate_due_payslips, list_payslips

NEW_USER = {"name": "Asha", "email": "asha@example.com", "password": "correct horse"}
EMPLOYERS = "/api/v1/salary/employers"
PAYSLIPS = "/api/v1/salary/payslips"
NOTIFICATIONS = "/api/v1/notifications"
RUPEE = 100

JOINING_LINES = [
    {"name": "Basic", "kind": "earning", "yearly_amount": 600_000 * RUPEE},
    {"name": "House rent allowance", "kind": "earning", "yearly_amount": 300_000 * RUPEE},
    {"name": "Employee PF", "kind": "deduction", "yearly_amount": 72_000 * RUPEE},
    {"name": "Professional tax", "kind": "deduction", "yearly_amount": 2_400 * RUPEE},
    {"name": "Employer PF", "kind": "employer_contribution", "yearly_amount": 72_000 * RUPEE},
]
MONTHLY_NET = (50_000 + 25_000 - 6_000 - 200) * RUPEE


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}", payslip_job_interval_seconds=0, _env_file=None
    )
    with TestClient(create_app(settings)) as test_client:
        test_client.post("/api/v1/auth/sign-up", json=NEW_USER)
        assert test_client.post("/api/v1/categories/presets").status_code in (200, 201)
        yield test_client


def _account(client: TestClient) -> int:
    body = {"category": "savings", "name": "HDFC Savings", "icon": "bank", "currency": "INR"}
    return client.post("/api/v1/accounts", json=body).json()["id"]


def _balance(client: TestClient, account_id: int) -> int:
    return client.get(f"/api/v1/accounts/{account_id}").json()["balance"]


def _employer(client: TestClient, added_on: date = date(2024, 6, 1), **fields: object) -> dict:
    body = {
        "name": "Acme",
        "joined_on": "2024-06-20",
        "first_pay_on": "2024-07-31",  # joined after the June cut-off
        "pay_day": 31,
        "left_on": "2025-06-30",
        "lines": JOINING_LINES,
        **fields,
    }
    response = client.post(EMPLOYERS, json=body)
    assert response.status_code == 201, response.text
    employer = response.json()
    with client.app.state.sessionmaker() as db:
        db.execute(
            update(Employer)
            .where(Employer.id == employer["id"])
            .values(created_at=datetime.combine(added_on, datetime.min.time()))
        )
        db.commit()
    return employer


def _user_id(client: TestClient) -> int:
    return client.get("/api/v1/auth/me").json()["id"]


def _generate(client: TestClient, today: date) -> int:
    with client.app.state.sessionmaker() as db:
        return generate_due_payslips(db, _user_id(client), today)


def _by_month(client: TestClient) -> dict[str, dict]:
    """The payslips by "YYYY-MM", without drafting up to the real today as the list route does."""
    with client.app.state.sessionmaker() as db:
        return {p.pay_month.isoformat()[:7]: p.model_dump(mode="json") for p in list_payslips(db, _user_id(client))}


def _detail(client: TestClient, payslip_id: int) -> dict:
    response = client.get(f"{PAYSLIPS}/{payslip_id}")
    assert response.status_code == 200, response.text
    return response.json()


def _amounts(payslip: dict) -> dict[str, int]:
    return {line["name"]: line["amount"] for line in payslip["lines"]}


def _lines(payslip: dict, **changes: int) -> list[dict]:
    return [
        {"component_id": line["component_id"], "amount": changes.get(line["name"].split()[0], line["amount"])}
        for line in payslip["lines"]
    ]


def test_pay_day_drafts_each_due_month_once_and_notifies(client: TestClient) -> None:
    _employer(client, salary_account_id=_account(client))
    assert _generate(client, date(2024, 7, 30)) == 0  # the first pay day has not come
    assert _generate(client, date(2024, 9, 15)) == 2  # 31 July and 31 August
    assert _generate(client, date(2024, 9, 15)) == 0  # already drafted
    months = _by_month(client)
    assert sorted(months) == ["2024-07", "2024-08"]
    assert (months["2024-07"]["pay_date"], months["2024-08"]["pay_date"]) == ("2024-07-31", "2024-08-31")
    assert all(p["status"] == "draft" for p in months.values())

    notifications = client.get(NOTIFICATIONS).json()
    assert notifications["unread_count"] == 2
    assert notifications["items"][0]["link"].startswith("/salary/payslips/")
    assert "ready to review" in notifications["items"][0]["title"]


def test_no_drafts_before_the_employer_was_added_or_after_leaving(client: TestClient) -> None:
    _employer(client, added_on=date(2024, 9, 1))
    assert _generate(client, date(2024, 9, 15)) == 0  # July and August were paid before it was added
    assert _generate(client, date(2026, 1, 1)) == 10  # September 2024 to June 2025, when the job ended
    assert max(_by_month(client)) == "2025-06"


def test_a_draft_starts_from_a_twelfth_of_the_yearly_pay(client: TestClient) -> None:
    _employer(client, salary_account_id=_account(client))
    _generate(client, date(2024, 7, 31))
    july = _detail(client, _by_month(client)["2024-07"]["id"])
    assert july["prefill_source"] == "revision"
    assert _amounts(july) == {
        "Basic": 50_000 * RUPEE,
        "House rent allowance": 25_000 * RUPEE,
        "Employee PF": 6_000 * RUPEE,
        "Professional tax": 200 * RUPEE,
        "Employer PF": 6_000 * RUPEE,
    }
    assert july["totals"]["net"] == MONTHLY_NET
    assert july["category_id"] is not None  # the preset "Salary Income"
    assert july["post_problem"] is None


def test_approving_posts_the_take_home_pay_to_the_salary_account(client: TestClient) -> None:
    account_id = _account(client)
    _employer(client, salary_account_id=account_id)
    _generate(client, date(2024, 7, 31))
    july_id = _by_month(client)["2024-07"]["id"]

    posted = client.post(f"{PAYSLIPS}/{july_id}/post").json()
    assert posted["status"] == "posted"
    assert len(posted["transaction_ids"]) == 1
    assert _balance(client, account_id) == MONTHLY_NET
    assert client.get(NOTIFICATIONS).json()["unread_count"] == 0  # dealt with
    assert client.post(f"{PAYSLIPS}/{july_id}/post").status_code == 409

    # Editing an approved payslip moves its transaction with it.
    edited = client.patch(f"{PAYSLIPS}/{july_id}", json={"lines": _lines(posted, Basic=51_000 * RUPEE)}).json()
    assert (edited["status"], edited["prefill_source"]) == ("posted", "manual")
    assert _balance(client, account_id) == MONTHLY_NET + 1_000 * RUPEE

    # Deleting it takes the transaction away, and the job does not draft the month again.
    assert client.delete(f"{PAYSLIPS}/{july_id}").status_code == 204
    assert _balance(client, account_id) == 0
    assert client.get(f"{PAYSLIPS}/{july_id}").status_code == 404
    assert _generate(client, date(2024, 8, 1)) == 0


def test_later_months_repeat_the_last_approved_payslip_until_a_revision_takes_effect(client: TestClient) -> None:
    employer = _employer(client, salary_account_id=_account(client))
    basic = next(
        c["id"] for c in client.get(f"{EMPLOYERS}/{employer['id']}").json()["components"] if c["name"] == "Basic"
    )
    appraisal = {
        "kind": "appraisal",
        "announced_on": "2025-03-10",
        "effective_from": "2025-04-01",
        "lines": [{"component_id": basic, "yearly_amount": 720_000 * RUPEE}],
    }
    assert client.post(f"{EMPLOYERS}/{employer['id']}/revisions", json=appraisal).status_code == 201

    _generate(client, date(2024, 7, 31))
    july = _detail(client, _by_month(client)["2024-07"]["id"])
    client.patch(f"{PAYSLIPS}/{july['id']}", json={"lines": _lines(july, Basic=51_000 * RUPEE)})
    client.post(f"{PAYSLIPS}/{july['id']}/post")

    _generate(client, date(2025, 4, 30))
    months = _by_month(client)
    march = _detail(client, months["2025-03"]["id"])
    assert march["prefill_source"] == "previous"  # the monthly numbers the user entered
    assert _amounts(march)["Basic"] == 51_000 * RUPEE
    april = _detail(client, months["2025-04"]["id"])
    assert april["prefill_source"] == "revision"  # the appraisal applies, not last month's numbers
    assert _amounts(april) == {
        "Basic": 60_000 * RUPEE,
        "House rent allowance": 0,
        "Employee PF": 0,
        "Professional tax": 0,
        "Employer PF": 0,
    }
    assert april["revision_id"] is not None


def test_refill_brings_a_draft_up_to_date(client: TestClient) -> None:
    _employer(client, salary_account_id=_account(client))
    _generate(client, date(2024, 8, 31))
    months = _by_month(client)
    july, august = _detail(client, months["2024-07"]["id"]), _detail(client, months["2024-08"]["id"])
    client.patch(f"{PAYSLIPS}/{july['id']}", json={"lines": _lines(july, Basic=55_000 * RUPEE)})
    client.post(f"{PAYSLIPS}/{july['id']}/post")
    assert august["prefill_source"] == "revision"  # drafted before July was approved
    refilled = client.post(f"{PAYSLIPS}/{august['id']}/refill").json()
    assert (refilled["prefill_source"], _amounts(refilled)["Basic"]) == ("previous", 55_000 * RUPEE)
    assert client.post(f"{PAYSLIPS}/{july['id']}/refill").status_code == 409


def test_a_month_can_be_added_by_hand(client: TestClient) -> None:
    employer = _employer(client, salary_account_id=_account(client))
    created = client.post(PAYSLIPS, json={"employer_id": employer["id"], "pay_month": "2024-12-15"})
    assert created.status_code == 201, created.text
    assert (created.json()["pay_month"], created.json()["pay_date"]) == ("2024-12-01", "2024-12-31")
    again = client.post(PAYSLIPS, json={"employer_id": employer["id"], "pay_month": "2024-12-01"})
    assert again.status_code == 409
    for month in ("2024-05-01", "2025-07-01"):  # before joining, after leaving
        response = client.post(PAYSLIPS, json={"employer_id": employer["id"], "pay_month": month})
        assert response.status_code == 422
        assert response.json()["error"]["details"][0]["field"] == "pay_month"

    # A dismissed month comes back as a fresh draft.
    client.delete(f"{PAYSLIPS}/{created.json()['id']}")
    revived = client.post(PAYSLIPS, json={"employer_id": employer["id"], "pay_month": "2024-12-01"})
    assert (revived.status_code, revived.json()["status"], revived.json()["id"]) == (201, "draft", created.json()["id"])


def test_a_payslip_needs_a_salary_account_and_category_to_be_approved(client: TestClient) -> None:
    employer = _employer(client)  # a past job: no account needed to set it up
    payslip = client.post(PAYSLIPS, json={"employer_id": employer["id"], "pay_month": "2024-08-01"}).json()
    assert "account" in payslip["post_problem"]
    response = client.post(f"{PAYSLIPS}/{payslip['id']}/post")
    assert (response.status_code, response.json()["error"]["code"]) == (422, "payslip_not_ready")

    client.patch(f"{EMPLOYERS}/{employer['id']}", json={"salary_account_id": _account(client)})
    no_category = client.patch(f"{PAYSLIPS}/{payslip['id']}", json={"category_id": None}).json()
    assert "category" in no_category["post_problem"]


def test_bad_edits_are_refused(client: TestClient) -> None:
    employer = _employer(client, salary_account_id=_account(client))
    other = _employer(client, name="Other Co")
    payslip = client.post(PAYSLIPS, json={"employer_id": employer["id"], "pay_month": "2024-08-01"}).json()
    url = f"{PAYSLIPS}/{payslip['id']}"
    assert client.patch(url, json={"pay_date": "2024-09-01"}).json()["error"]["details"][0]["field"] == "pay_date"
    assert client.patch(url, json={"pay_date": "2024-08-30"}).json()["pay_date"] == "2024-08-30"
    foreign = next(c["id"] for c in client.get(f"{EMPLOYERS}/{other['id']}").json()["components"])
    response = client.patch(url, json={"lines": [{"component_id": foreign, "amount": 1}]})
    assert (response.status_code, response.json()["error"]["details"][0]["field"]) == (422, "lines")
    assert client.patch(url, json={"lines": [{"component_id": foreign, "amount": -1}]}).status_code == 422


def test_approved_payslips_protect_their_employer_and_components(client: TestClient) -> None:
    employer = _employer(client, salary_account_id=_account(client))
    payslip = client.post(PAYSLIPS, json={"employer_id": employer["id"], "pay_month": "2024-08-01"}).json()
    client.post(f"{PAYSLIPS}/{payslip['id']}/post")
    basic = next(line["component_id"] for line in payslip["lines"] if line["name"] == "Basic")
    assert client.delete(f"{EMPLOYERS}/{employer['id']}/components/{basic}").status_code == 409
    assert client.delete(f"{EMPLOYERS}/{employer['id']}").status_code == 409
    client.delete(f"{PAYSLIPS}/{payslip['id']}")
    assert client.delete(f"{EMPLOYERS}/{employer['id']}").status_code == 204


def test_clearing_transactions_turns_approved_payslips_back_into_drafts(client: TestClient) -> None:
    employer = _employer(client, salary_account_id=_account(client))
    payslip = client.post(PAYSLIPS, json={"employer_id": employer["id"], "pay_month": "2024-08-01"}).json()
    client.post(f"{PAYSLIPS}/{payslip['id']}/post")
    cleared = client.post("/api/v1/data/clear", json={"scope": "transactions", "password": "correct horse"})
    assert cleared.status_code == 204
    after = _detail(client, payslip["id"])
    assert (after["status"], after["transaction_ids"]) == ("draft", [])


def test_payslips_list_filters_and_is_private(client: TestClient) -> None:
    employer = _employer(client, salary_account_id=_account(client))
    _employer(client, name="Side gig", added_on=date(2030, 1, 1))  # never due in this test
    _generate(client, date(2024, 8, 31))
    july = _by_month(client)["2024-07"]["id"]
    client.post(f"{PAYSLIPS}/{july}/post")
    listed = client.get(PAYSLIPS, params={"employer_id": employer["id"], "status": "posted"}).json()
    assert [p["id"] for p in listed] == [july]
    assert listed[0]["employer_name"] == "Acme"

    other = TestClient(client.app)
    other.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "ravi@example.com"})
    assert other.get(f"{PAYSLIPS}/{july}").status_code == 404
    assert other.get(PAYSLIPS).json() == []


def test_notifications_can_be_read(client: TestClient) -> None:
    _employer(client, salary_account_id=_account(client))
    _generate(client, date(2024, 8, 31))
    items = client.get(NOTIFICATIONS).json()["items"]
    assert client.post(f"{NOTIFICATIONS}/{items[0]['id']}/read").status_code == 204
    assert client.get(NOTIFICATIONS).json()["unread_count"] == 1
    assert client.post(f"{NOTIFICATIONS}/read").status_code == 204
    assert client.get(NOTIFICATIONS).json()["unread_count"] == 0
    assert client.post(f"{NOTIFICATIONS}/99999/read").status_code == 404


def test_the_pay_day_job_drafts_for_every_user(client: TestClient) -> None:
    _employer(client, salary_account_id=_account(client))  # added June 2024, left June 2025
    assert _run_once(client.app.state.sessionmaker) == 12  # July 2024 to June 2025
    assert _run_once(client.app.state.sessionmaker) == 0
