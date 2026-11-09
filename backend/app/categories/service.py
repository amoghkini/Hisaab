from sqlalchemy import delete, exists, func, select
from sqlalchemy.orm import Session

from app.categories.models import Category, CategoryType
from app.categories.presets import PRESETS, Preset
from app.categories.schemas import (
    CategoryIn,
    CategoryOrderIn,
    CategoryOut,
    CategoryUpdate,
    PresetCategoryOut,
    PresetGroupOut,
)
from app.errors import ApiError
from app.transactions.models import Transaction


def _preset_out(preset: Preset) -> PresetCategoryOut:
    return PresetCategoryOut(
        name=preset.name,
        icon=preset.icon,
        color=preset.color,
        sub_categories=[_preset_out(sub) for sub in preset.sub_categories],
    )


def preset_groups() -> list[PresetGroupOut]:
    return [
        PresetGroupOut(type=kind, categories=[_preset_out(preset) for preset in presets])
        for kind, presets in PRESETS.items()
    ]


def create_preset_categories(db: Session, user_id: int) -> None:
    """Give a user the preset categories. The caller commits."""
    for kind, presets in PRESETS.items():
        for order, preset in enumerate(presets):
            parent = Category(
                user_id=user_id, type=kind, name=preset.name, icon=preset.icon, color=preset.color, display_order=order
            )
            db.add(parent)
            db.flush()  # the sub-categories need its id
            for sub_order, sub in enumerate(preset.sub_categories):
                db.add(
                    Category(
                        user_id=user_id,
                        type=kind,
                        parent_id=parent.id,
                        name=sub.name,
                        icon=sub.icon,
                        color=sub.color,
                        display_order=sub_order,
                    )
                )


def _out(category: Category, subs: list[Category], counts: dict[int, int]) -> CategoryOut:
    return CategoryOut(
        id=category.id,
        type=CategoryType(category.type),
        parent_id=category.parent_id,
        name=category.name,
        icon=category.icon,
        color=category.color,
        hidden=category.hidden,
        display_order=category.display_order,
        transaction_count=counts.get(category.id, 0),
        sub_categories=[_out(sub, [], counts) for sub in subs],
    )


def _transaction_counts(db: Session, user_id: int) -> dict[int, int]:
    rows = db.execute(
        select(Transaction.category_id, func.count())
        .where(Transaction.user_id == user_id, Transaction.category_id.is_not(None))
        .group_by(Transaction.category_id)
    ).all()
    return {category_id: count for category_id, count in rows}


def list_categories(db: Session, user_id: int) -> list[CategoryOut]:
    """The user's categories as a tree: top-level ones in order, each with its sub-categories in order."""
    rows = db.scalars(
        select(Category).where(Category.user_id == user_id).order_by(Category.display_order, Category.id)
    ).all()
    children: dict[int, list[Category]] = {}
    for row in rows:
        if row.parent_id is not None:
            children.setdefault(row.parent_id, []).append(row)
    order = list(CategoryType)
    tops = sorted((row for row in rows if row.parent_id is None), key=lambda row: order.index(CategoryType(row.type)))
    counts = _transaction_counts(db, user_id)
    return [_out(top, children.get(top.id, []), counts) for top in tops]


def category_out(db: Session, category: Category) -> CategoryOut:
    subs = db.scalars(
        select(Category).where(Category.parent_id == category.id).order_by(Category.display_order, Category.id)
    ).all()
    return _out(category, list(subs), _transaction_counts(db, category.user_id))


def add_preset_categories(db: Session, user_id: int) -> list[CategoryOut]:
    """For a user who skipped the presets at sign-up. Refused once they have any category, to avoid duplicates."""
    if db.scalar(select(exists().where(Category.user_id == user_id))):
        raise ApiError(409, "categories_exist", "You already have categories.")
    create_preset_categories(db, user_id)
    db.commit()
    return list_categories(db, user_id)


def get_category(db: Session, user_id: int, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise ApiError(404, "category_not_found", "This category does not exist.")
    return category


def _invalid(field: str, message: str) -> ApiError:
    return ApiError(422, "validation_failed", message, [{"field": field, "message": message}])


def _group(db: Session, user_id: int, parent_id: int, kind: str) -> Category:
    """The top-level category a sub-category goes in. One level only, as in ezBookkeeping."""
    parent = db.get(Category, parent_id)
    if parent is None or parent.user_id != user_id:
        raise _invalid("parent_id", "Choose one of your categories.")
    if parent.parent_id is not None:
        raise _invalid("parent_id", "Choose a top-level category; sub-categories cannot have their own.")
    if parent.type != kind:
        raise _invalid("parent_id", f"Choose a {kind} category.")
    return parent


def _next_order(db: Session, user_id: int, kind: str, parent_id: int | None) -> int:
    last = db.scalar(
        select(func.max(Category.display_order)).where(
            Category.user_id == user_id,
            Category.type == kind,
            Category.parent_id.is_(None) if parent_id is None else Category.parent_id == parent_id,
        )
    )
    return 0 if last is None else last + 1


def create_category(db: Session, user_id: int, data: CategoryIn) -> Category:
    if data.parent_id is not None:
        _group(db, user_id, data.parent_id, data.type)
    category = Category(
        user_id=user_id,
        type=data.type,
        parent_id=data.parent_id,
        name=data.name,
        icon=data.icon,
        color=data.color,
        display_order=_next_order(db, user_id, data.type, data.parent_id),
    )
    db.add(category)
    db.commit()
    return category


def update_category(db: Session, category: Category, data: CategoryUpdate) -> Category:
    changes = data.changes()
    new_parent = changes.pop("parent_id", None)
    if new_parent is not None and new_parent != category.parent_id:
        if category.parent_id is None:
            raise _invalid("parent_id", "A top-level category cannot move into another one.")
        _group(db, category.user_id, int(new_parent), category.type)
        category.parent_id = int(new_parent)
        category.display_order = _next_order(db, category.user_id, category.type, category.parent_id)
    for name, value in changes.items():
        setattr(category, name, value)
    db.commit()
    return category


def delete_category(db: Session, category: Category) -> None:
    """Delete a category, and its sub-categories if it is a group. Refused while any of them has transactions."""
    family = [category.id, *db.scalars(select(Category.id).where(Category.parent_id == category.id))]
    used = db.scalar(select(func.count()).where(Transaction.category_id.in_(family)))
    if used:
        noun = "transaction" if used == 1 else "transactions"
        raise ApiError(
            409,
            "category_in_use",
            f"This category has {used} {noun}, so it cannot be deleted. Change their category first, or hide it.",
        )
    db.execute(delete(Category).where(Category.parent_id == category.id))
    db.delete(category)
    db.commit()


def reorder_categories(db: Session, user_id: int, data: CategoryOrderIn) -> list[CategoryOut]:
    """Set the order of one type's top-level categories, or of one group's sub-categories. Each must be listed once."""
    siblings = db.scalars(
        select(Category).where(
            Category.user_id == user_id,
            Category.type == data.type,
            Category.parent_id.is_(None) if data.parent_id is None else Category.parent_id == data.parent_id,
        )
    ).all()
    by_id = {category.id: category for category in siblings}
    if len(data.ids) != len(set(data.ids)) or set(data.ids) != set(by_id):
        raise ApiError(
            422, "order_mismatch", "The order must list every category here once. Reload the page and try again."
        )
    for order, category_id in enumerate(data.ids):
        by_id[category_id].display_order = order
    db.commit()
    return list_categories(db, user_id)
