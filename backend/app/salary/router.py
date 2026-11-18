from datetime import date

from fastapi import APIRouter, Response, status

from app.auth.deps import DB, CurrentUser
from app.salary import payslips, service
from app.salary.models import PayslipStatus
from app.salary.presets import PRESET_COMPONENTS
from app.salary.schemas import (
    ComponentIn,
    ComponentPresetOut,
    ComponentUpdate,
    DocumentIn,
    EmployerDetailOut,
    EmployerIn,
    EmployerOut,
    EmployerUpdate,
    PayslipCreateIn,
    PayslipDetailOut,
    PayslipOut,
    PayslipUpdate,
    RevisionIn,
    RevisionUpdate,
)

router = APIRouter(prefix="/api/v1/salary", tags=["salary"])

# Every change to an employer answers with the whole employer, so the page can show it without asking again.


@router.get("/component-presets")
def presets_route(_: CurrentUser) -> list[ComponentPresetOut]:
    """Components common in Indian payslips, to pick from when setting up an employer."""
    return [ComponentPresetOut(name=name, kind=kind) for name, kind in PRESET_COMPONENTS]


@router.get("/employers")
def list_route(user: CurrentUser, db: DB) -> list[EmployerOut]:
    """Current employers first, then past ones, with the totals of the pay in force."""
    return service.list_employers(db, user.id)


@router.post("/employers", status_code=status.HTTP_201_CREATED)
def create_route(data: EmployerIn, user: CurrentUser, db: DB) -> EmployerDetailOut:
    """Onboarding: the employer, its salary components and the joining offer's yearly amounts."""
    return service.employer_detail(db, service.create_employer(db, user.id, data))


@router.get("/employers/{employer_id}")
def get_route(employer_id: int, user: CurrentUser, db: DB) -> EmployerDetailOut:
    return service.employer_detail(db, service.get_employer(db, user.id, employer_id))


@router.patch("/employers/{employer_id}")
def update_route(employer_id: int, data: EmployerUpdate, user: CurrentUser, db: DB) -> EmployerDetailOut:
    employer = service.update_employer(db, service.get_employer(db, user.id, employer_id), data)
    return service.employer_detail(db, employer)


@router.delete("/employers/{employer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_route(employer_id: int, user: CurrentUser, db: DB) -> Response:
    service.delete_employer(db, service.get_employer(db, user.id, employer_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/employers/{employer_id}/components", status_code=status.HTTP_201_CREATED)
def add_component_route(employer_id: int, data: ComponentIn, user: CurrentUser, db: DB) -> EmployerDetailOut:
    employer = service.get_employer(db, user.id, employer_id)
    service.add_component(db, employer, data)
    return service.employer_detail(db, employer)


@router.patch("/employers/{employer_id}/components/{component_id}")
def update_component_route(
    employer_id: int, component_id: int, data: ComponentUpdate, user: CurrentUser, db: DB
) -> EmployerDetailOut:
    employer = service.get_employer(db, user.id, employer_id)
    service.update_component(db, employer, component_id, data)
    return service.employer_detail(db, employer)


@router.delete("/employers/{employer_id}/components/{component_id}")
def delete_component_route(employer_id: int, component_id: int, user: CurrentUser, db: DB) -> EmployerDetailOut:
    """Removes the component from every pay revision too."""
    employer = service.get_employer(db, user.id, employer_id)
    service.delete_component(db, employer, component_id)
    return service.employer_detail(db, employer)


@router.post("/employers/{employer_id}/revisions", status_code=status.HTTP_201_CREATED)
def add_revision_route(employer_id: int, data: RevisionIn, user: CurrentUser, db: DB) -> EmployerDetailOut:
    """An appraisal, promotion or restructure, with the new yearly amounts and the date they apply from."""
    employer = service.get_employer(db, user.id, employer_id)
    service.add_revision(db, employer, data)
    return service.employer_detail(db, employer)


@router.patch("/employers/{employer_id}/revisions/{revision_id}")
def update_revision_route(
    employer_id: int, revision_id: int, data: RevisionUpdate, user: CurrentUser, db: DB
) -> EmployerDetailOut:
    employer = service.get_employer(db, user.id, employer_id)
    service.update_revision(db, employer, revision_id, data)
    return service.employer_detail(db, employer)


@router.delete("/employers/{employer_id}/revisions/{revision_id}")
def delete_revision_route(employer_id: int, revision_id: int, user: CurrentUser, db: DB) -> EmployerDetailOut:
    employer = service.get_employer(db, user.id, employer_id)
    service.delete_revision(db, employer, revision_id)
    return service.employer_detail(db, employer)


@router.post("/employers/{employer_id}/documents", status_code=status.HTTP_201_CREATED)
def add_document_route(employer_id: int, data: DocumentIn, user: CurrentUser, db: DB) -> EmployerDetailOut:
    """A document's details, entered by hand. Uploading the file comes later."""
    employer = service.get_employer(db, user.id, employer_id)
    service.add_document(db, employer, data)
    return service.employer_detail(db, employer)


@router.put("/employers/{employer_id}/documents/{document_id}")
def replace_document_route(
    employer_id: int, document_id: int, data: DocumentIn, user: CurrentUser, db: DB
) -> EmployerDetailOut:
    employer = service.get_employer(db, user.id, employer_id)
    service.replace_document(db, employer, document_id, data)
    return service.employer_detail(db, employer)


@router.delete("/employers/{employer_id}/documents/{document_id}")
def delete_document_route(employer_id: int, document_id: int, user: CurrentUser, db: DB) -> EmployerDetailOut:
    employer = service.get_employer(db, user.id, employer_id)
    service.delete_document(db, employer, document_id)
    return service.employer_detail(db, employer)


# Payslips


@router.get("/payslips")
def list_payslips_route(
    user: CurrentUser,
    db: DB,
    employer_id: int | None = None,
    status: PayslipStatus | None = None,
) -> list[PayslipOut]:
    """Newest month first. Drafts any pay day that has come first, so the list is never behind the job."""
    payslips.generate_due_payslips(db, user.id, date.today())
    return payslips.list_payslips(db, user.id, employer_id, status)


@router.post("/payslips", status_code=status.HTTP_201_CREATED)
def create_payslip_route(data: PayslipCreateIn, user: CurrentUser, db: DB) -> PayslipDetailOut:
    """A month added by hand, pre-filled like a drafted one."""
    return payslips.payslip_detail(db, payslips.create_payslip(db, user.id, data))


@router.get("/payslips/{payslip_id}")
def get_payslip_route(payslip_id: int, user: CurrentUser, db: DB) -> PayslipDetailOut:
    return payslips.payslip_detail(db, payslips.get_payslip(db, user.id, payslip_id))


@router.patch("/payslips/{payslip_id}")
def update_payslip_route(payslip_id: int, data: PayslipUpdate, user: CurrentUser, db: DB) -> PayslipDetailOut:
    """Change the amounts, pay date, category or note. An approved payslip's transaction follows."""
    found = payslips.update_payslip(db, payslips.get_payslip(db, user.id, payslip_id), data)
    return payslips.payslip_detail(db, found)


@router.post("/payslips/{payslip_id}/refill")
def refill_payslip_route(payslip_id: int, user: CurrentUser, db: DB) -> PayslipDetailOut:
    """Start a draft's amounts again from the pay in force or the last approved payslip."""
    return payslips.payslip_detail(db, payslips.refill_payslip(db, payslips.get_payslip(db, user.id, payslip_id)))


@router.post("/payslips/{payslip_id}/post")
def post_payslip_route(payslip_id: int, user: CurrentUser, db: DB) -> PayslipDetailOut:
    """Approve: the take-home pay becomes an income transaction in the salary account."""
    return payslips.payslip_detail(db, payslips.post_payslip(db, payslips.get_payslip(db, user.id, payslip_id)))


@router.delete("/payslips/{payslip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payslip_route(payslip_id: int, user: CurrentUser, db: DB) -> Response:
    """Removes its transaction too. The month is not drafted again unless added by hand."""
    payslips.dismiss_payslip(db, payslips.get_payslip(db, user.id, payslip_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
