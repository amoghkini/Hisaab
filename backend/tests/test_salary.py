"""Employers, salary components, pay revisions and documents.

Dates are far enough in the past or future that "today" never changes which revision is in force.
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.salary.service import first_pay_date, monthly_amount

NEW_USER = {"name": "Asha", "email": "asha@example.com", "password": "correct horse"}
URL = "/api/v1/salary/employers"
SAVINGS = {"category": "savings", "name": "HDFC Savings", "icon": "bank", "currency": "INR"}
RUPEE = 100

JOINING_LINES = [
    {"name": "Basic", "kind": "earning", "yearly_amount": 600_000 * RUPEE},
    {"name": "House rent allowance", "kind": "earning", "yearly_amount": 300_000 * RUPEE},
    {"name": "Employee PF", "kind": "deduction", "yearly_amount": 72_000 * RUPEE},
    {"name": "Professional tax", "kind": "deduction", "yearly_amount": 2_400 * RUPEE},
    {"name": "Employer PF", "kind": "employer_contribution", "yearly_amount": 72_000 * RUPEE},
]


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app(Settings(database_url=f"sqlite:///{tmp_path / 'test.db'}", _env_file=None))
    with TestClient(app) as test_client:
        test_client.post("/api/v1/auth/sign-up", json=NEW_USER)
        yield test_client


def _account(client: TestClient, **fields: object) -> int:
    response = client.post("/api/v1/accounts", json={**SAVINGS, **fields})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _employer(client: TestClient, **fields: object) -> dict:
    body = {
        "name": "Acme Software",
        "employee_code": "AC123",
        "joined_on": "2023-06-20",
        "pay_day": 30,
        "designation": "Engineer",
        "uan": "100200300400",
        "lines": JOINING_LINES,
        **fields,
    }
    response = client.post(URL, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _ids(employer: dict) -> dict[str, int]:
    return {component["name"]: component["id"] for component in employer["components"]}


def _error_field(response) -> str:  # noqa: ANN001 - an httpx response
    return response.json()["error"]["details"][0]["field"]


def test_presets_cover_the_three_kinds(client: TestClient) -> None:
    presets = client.get("/api/v1/salary/component-presets").json()
    assert {preset["kind"] for preset in presets} == {"earning", "deduction", "employer_contribution"}
    assert {"name": "Basic", "kind": "earning"} in presets


def test_first_pay_date_and_monthly_rounding() -> None:
    from datetime import date

    assert first_pay_date(date(2023, 6, 20), 30) == date(2023, 6, 30)
    assert first_pay_date(date(2023, 6, 20), 1) == date(2023, 7, 1)  # joined after the cut-off
    assert first_pay_date(date(2024, 2, 10), 31) == date(2024, 2, 29)  # a short month pays on its last day
    assert first_pay_date(date(2023, 12, 20), 5) == date(2024, 1, 5)
    assert monthly_amount(100_001 * RUPEE) == 8_333 * RUPEE
    assert monthly_amount(0) == 0


def test_onboarding_creates_the_employer_components_and_joining_offer(client: TestClient) -> None:
    account_id = _account(client)
    employer = _employer(client, salary_account_id=account_id)
    assert employer["first_pay_on"] == "2023-06-30"
    assert (employer["salary_account_id"], employer["salary_account_ok"]) == (account_id, True)
    assert (employer["is_current"], employer["designation"], employer["uan"]) == (True, "Engineer", "100200300400")
    assert [c["kind"] for c in employer["components"]] == [
        "earning",
        "earning",
        "deduction",
        "deduction",
        "employer_contribution",
    ]
    [joining] = employer["revisions"]
    assert (joining["kind"], joining["effective_from"], joining["status"]) == ("joining", "2023-06-20", "current")
    assert employer["current_revision_id"] == joining["id"]
    assert employer["yearly"] == {
        "gross": 900_000 * RUPEE,
        "deductions": 74_400 * RUPEE,
        "net": 825_600 * RUPEE,
        "employer_contributions": 72_000 * RUPEE,
        "ctc": 972_000 * RUPEE,
    }
    assert employer["monthly"] == {
        "gross": 75_000 * RUPEE,
        "deductions": 6_200 * RUPEE,
        "net": 68_800 * RUPEE,
        "employer_contributions": 6_000 * RUPEE,
        "ctc": 81_000 * RUPEE,
    }
    assert client.get(f"{URL}/{employer['id']}").json() == employer
    [listed] = client.get(URL).json()
    assert listed["monthly"] == employer["monthly"]
    assert "components" not in listed


def test_first_pay_date_can_be_given(client: TestClient) -> None:
    assert _employer(client, first_pay_on="2023-07-31")["first_pay_on"] == "2023-07-31"


@pytest.mark.parametrize(
    ("fields", "field"),
    [
        ({"left_on": "2023-01-01"}, "left_on"),
        ({"first_pay_on": "2023-06-01"}, "first_pay_on"),
        ({"uan": "12345"}, "uan"),
        ({"pay_day": 32}, "pay_day"),
        ({"name": "  "}, "name"),
        ({"lines": []}, "lines"),
        ({"lines": [JOINING_LINES[0], JOINING_LINES[0]]}, "lines"),
        ({"lines": [{"name": "Basic", "yearly_amount": 1}]}, "lines"),
        ({"lines": [{**JOINING_LINES[0], "yearly_amount": -1}]}, "yearly_amount"),
    ],
)
def test_bad_onboarding_is_refused(client: TestClient, fields: dict, field: str) -> None:
    response = client.post(
        URL, json={"name": "Acme", "joined_on": "2023-06-20", "pay_day": 30, "lines": JOINING_LINES, **fields}
    )
    assert response.status_code == 422, response.text
    assert _error_field(response) == field
    assert client.get(URL).json() == []


def test_salary_account_must_be_ones_own_savings_or_current_account(client: TestClient) -> None:
    other = TestClient(client.app)
    other.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "ravi@example.com"})
    theirs = _account(other)
    card = _account(client, category="credit_card", name="Card")
    for bad in (theirs, 99999, card):
        response = client.post(
            URL,
            json={
                "name": "Acme",
                "joined_on": "2023-06-20",
                "pay_day": 30,
                "lines": JOINING_LINES,
                "salary_account_id": bad,
            },
        )
        assert response.status_code == 422
        assert _error_field(response) == "salary_account_id"
    current = _account(client, category="current", name="Current")
    assert _employer(client, salary_account_id=current)["salary_account_id"] == current


def test_an_account_that_stops_being_savings_or_current_is_reported(client: TestClient) -> None:
    account_id = _account(client)
    employer = _employer(client, salary_account_id=account_id)
    client.patch(f"/api/v1/accounts/{account_id}", json={"category": "wallet"})
    found = client.get(f"{URL}/{employer['id']}").json()
    assert (found["salary_account_id"], found["salary_account_ok"]) == (account_id, False)


def test_each_employer_has_its_own_salary_account_and_past_ones_come_last(client: TestClient) -> None:
    first, second = _account(client, name="Old bank"), _account(client, name="New bank")
    past = _employer(client, name="Old Co", joined_on="2018-01-10", left_on="2023-05-31", salary_account_id=first)
    now = _employer(client, name="New Co", salary_account_id=second)
    listed = client.get(URL).json()
    assert [(e["name"], e["is_current"], e["salary_account_id"]) for e in listed] == [
        ("New Co", True, second),
        ("Old Co", False, first),
    ]
    assert past["id"] != now["id"]


def test_an_appraisal_applies_from_its_effective_date(client: TestClient) -> None:
    employer = _employer(client)
    ids = _ids(employer)
    appraisal = {
        "kind": "appraisal",
        "announced_on": "2024-03-15",
        "effective_from": "2024-04-01",
        "lines": [
            {"component_id": ids["Basic"], "yearly_amount": 720_000 * RUPEE},
            {"component_id": ids["Employee PF"], "yearly_amount": 86_400 * RUPEE},
            {"name": "Special allowance", "kind": "earning", "yearly_amount": 120_000 * RUPEE},
        ],
    }
    response = client.post(f"{URL}/{employer['id']}/revisions", json=appraisal)
    assert response.status_code == 201, response.text
    promotion = {
        "kind": "promotion",
        "announced_on": "2099-02-10",  # told in February, paid more from March
        "effective_from": "2099-03-01",
        "designation": "Senior Engineer",
        "lines": [{"component_id": ids["Basic"], "yearly_amount": 900_000 * RUPEE}],
    }
    found = client.post(f"{URL}/{employer['id']}/revisions", json=promotion).json()

    upcoming, current, joining = found["revisions"]
    assert [r["status"] for r in found["revisions"]] == ["upcoming", "current", "past"]
    assert (upcoming["designation_in_effect"], current["designation_in_effect"]) == ("Senior Engineer", "Engineer")
    assert current["designation"] is None  # an appraisal keeps the title
    assert found["current_revision_id"] == current["id"]
    assert found["designation"] == "Engineer"
    # HRA, professional tax and employer PF are not in the appraisal, so they are zero from April 2024.
    assert found["yearly"]["gross"] == (720_000 + 120_000) * RUPEE
    assert found["yearly"]["deductions"] == 86_400 * RUPEE
    assert "Special allowance" in _ids(found)
    assert joining["yearly"]["gross"] == 900_000 * RUPEE  # the old pay is kept


@pytest.mark.parametrize(
    ("effective_from", "status", "field"),
    [
        ("2023-01-01", 422, "effective_from"),  # before joining
        ("2023-06-20", 409, "effective_from"),  # the joining date
    ],
)
def test_revision_dates_are_checked(client: TestClient, effective_from: str, status: int, field: str) -> None:
    employer = _employer(client)
    basic = _ids(employer)["Basic"]
    revision = {
        "kind": "appraisal",
        "effective_from": effective_from,
        "lines": [{"component_id": basic, "yearly_amount": 1}],
    }
    response = client.post(f"{URL}/{employer['id']}/revisions", json=revision)
    assert response.status_code == status
    assert _error_field(response) == field


def test_two_revisions_cannot_start_on_the_same_day(client: TestClient) -> None:
    employer = _employer(client)
    revision = {
        "kind": "appraisal",
        "effective_from": "2024-04-01",
        "lines": [{"component_id": _ids(employer)["Basic"], "yearly_amount": 1}],
    }
    assert client.post(f"{URL}/{employer['id']}/revisions", json=revision).status_code == 201
    assert client.post(f"{URL}/{employer['id']}/revisions", json=revision).status_code == 409


def test_a_revision_cannot_use_another_employers_component(client: TestClient) -> None:
    first, second = _employer(client), _employer(client, name="Other Co")
    revision = {
        "kind": "appraisal",
        "effective_from": "2024-04-01",
        "lines": [{"component_id": _ids(second)["Basic"], "yearly_amount": 1}],
    }
    response = client.post(f"{URL}/{first['id']}/revisions", json=revision)
    assert response.status_code == 422
    assert _error_field(response) == "lines"


def test_the_joining_offer_moves_with_the_joining_date_and_cannot_be_deleted(client: TestClient) -> None:
    employer = _employer(client)
    joining_id = employer["revisions"][0]["id"]
    moved = client.patch(f"{URL}/{employer['id']}", json={"joined_on": "2023-06-01"}).json()
    assert moved["revisions"][0]["effective_from"] == "2023-06-01"
    assert client.delete(f"{URL}/{employer['id']}/revisions/{joining_id}").status_code == 409
    edited = client.patch(
        f"{URL}/{employer['id']}/revisions/{joining_id}", json={"designation": "Software Engineer"}
    ).json()
    assert edited["designation"] == "Software Engineer"


def test_the_joining_date_cannot_pass_a_later_revision(client: TestClient) -> None:
    employer = _employer(client)
    revision = {
        "kind": "appraisal",
        "effective_from": "2024-04-01",
        "lines": [{"component_id": _ids(employer)["Basic"], "yearly_amount": 1}],
    }
    client.post(f"{URL}/{employer['id']}/revisions", json=revision)
    response = client.patch(f"{URL}/{employer['id']}", json={"joined_on": "2024-05-01", "first_pay_on": "2024-05-31"})
    assert response.status_code == 422
    assert _error_field(response) == "joined_on"
    response = client.patch(f"{URL}/{employer['id']}", json={"left_on": "2024-03-31"})
    assert _error_field(response) == "left_on"


def test_components_can_be_added_renamed_and_deleted(client: TestClient) -> None:
    employer = _employer(client)
    added = client.post(
        f"{URL}/{employer['id']}/components", json={"name": "Gratuity", "kind": "employer_contribution"}
    )
    assert added.status_code == 201
    duplicate = client.post(f"{URL}/{employer['id']}/components", json={"name": "basic", "kind": "earning"})
    assert duplicate.status_code == 409
    hra = _ids(employer)["House rent allowance"]
    renamed = client.patch(f"{URL}/{employer['id']}/components/{hra}", json={"name": "HRA"}).json()
    assert "HRA" in _ids(renamed)
    after = client.delete(f"{URL}/{employer['id']}/components/{hra}").json()
    assert "HRA" not in _ids(after)
    assert after["yearly"]["gross"] == 600_000 * RUPEE  # gone from the joining offer too


def test_documents_are_entered_by_hand(client: TestClient) -> None:
    employer = _employer(client)
    url = f"{URL}/{employer['id']}/documents"
    no_year = client.post(url, json={"kind": "form16", "title": "Form 16"})
    assert no_year.status_code == 422
    form16 = {
        "kind": "form16",
        "title": "Form 16",
        "financial_year": 2024,
        "gross_salary": 900_000 * RUPEE,
        "tds": 50_000 * RUPEE,
    }
    assert client.post(url, json=form16).status_code == 201
    offer = {
        "kind": "offer_letter",
        "title": "Offer letter",
        "issued_on": "2023-05-01",
        "revision_id": employer["revisions"][0]["id"],
    }
    found = client.post(url, json=offer).json()
    assert [d["kind"] for d in found["documents"]] == ["form16", "offer_letter"]
    form16_id = found["documents"][0]["id"]
    replaced = client.put(f"{url}/{form16_id}", json={**form16, "financial_year": 2025}).json()
    assert replaced["documents"][0]["financial_year"] == 2025
    assert len(client.delete(f"{url}/{form16_id}").json()["documents"]) == 1


def test_deleting_a_revision_unlinks_its_documents(client: TestClient) -> None:
    employer = _employer(client)
    revision = {
        "kind": "appraisal",
        "effective_from": "2024-04-01",
        "lines": [{"component_id": _ids(employer)["Basic"], "yearly_amount": 1}],
    }
    found = client.post(f"{URL}/{employer['id']}/revisions", json=revision).json()
    appraisal_id = found["revisions"][0]["id"]
    letter = {"kind": "appraisal_letter", "title": "Appraisal 2024", "revision_id": appraisal_id}
    client.post(f"{URL}/{employer['id']}/documents", json=letter)
    after = client.delete(f"{URL}/{employer['id']}/revisions/{appraisal_id}").json()
    assert len(after["revisions"]) == 1
    assert after["documents"][0]["revision_id"] is None


def test_employers_are_private_and_can_be_deleted(client: TestClient) -> None:
    employer = _employer(client)
    other = TestClient(client.app)
    other.post("/api/v1/auth/sign-up", json={**NEW_USER, "email": "ravi@example.com"})
    assert other.get(f"{URL}/{employer['id']}").status_code == 404
    assert other.get(URL).json() == []
    assert client.delete(f"{URL}/{employer['id']}").status_code == 204
    assert client.get(f"{URL}/{employer['id']}").status_code == 404
