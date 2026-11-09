from fastapi import APIRouter, Response, status

from app.auth.deps import DB, CurrentUser
from app.categories.schemas import CategoryIn, CategoryOrderIn, CategoryOut, CategoryUpdate, PresetGroupOut
from app.categories.service import (
    add_preset_categories,
    category_out,
    create_category,
    delete_category,
    get_category,
    list_categories,
    preset_groups,
    reorder_categories,
    update_category,
)

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])


@router.get("")
def list_route(user: CurrentUser, db: DB) -> list[CategoryOut]:
    """The user's categories: expense, then income, then transfer, each top-level one with its sub-categories."""
    return list_categories(db, user.id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_route(data: CategoryIn, user: CurrentUser, db: DB) -> CategoryOut:
    """Add a top-level category, or a sub-category with `parent_id`. It goes last."""
    return category_out(db, create_category(db, user.id, data))


@router.get("/presets")
def presets_route() -> list[PresetGroupOut]:
    """The preset categories a new account can start with. Public: the sign-up page shows them."""
    return preset_groups()


@router.post("/presets", status_code=status.HTTP_201_CREATED)
def add_presets_route(user: CurrentUser, db: DB) -> list[CategoryOut]:
    """Give a user with no categories the preset ones. Answers with all their categories."""
    return add_preset_categories(db, user.id)


@router.put("/order")
def order_route(data: CategoryOrderIn, user: CurrentUser, db: DB) -> list[CategoryOut]:
    """Reorder one type's top-level categories, or one group's sub-categories. Answers with all categories."""
    return reorder_categories(db, user.id, data)


@router.patch("/{category_id}")
def update_route(category_id: int, data: CategoryUpdate, user: CurrentUser, db: DB) -> CategoryOut:
    """Rename, change the icon or colour, hide or show, or move a sub-category to another group."""
    return category_out(db, update_category(db, get_category(db, user.id, category_id), data))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_route(category_id: int, user: CurrentUser, db: DB) -> Response:
    """Delete a category and its sub-categories. Refused while any of them has transactions."""
    delete_category(db, get_category(db, user.id, category_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
