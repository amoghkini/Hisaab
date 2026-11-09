from sqlalchemy.orm import Session

from app.categories.models import Category
from app.categories.presets import PRESETS, Preset
from app.categories.schemas import PresetCategoryOut, PresetGroupOut


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
