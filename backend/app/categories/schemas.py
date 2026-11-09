from pydantic import BaseModel

from app.categories.models import CategoryType


class PresetCategoryOut(BaseModel):
    name: str
    icon: str
    color: str | None
    sub_categories: list["PresetCategoryOut"] = []


class PresetGroupOut(BaseModel):
    type: CategoryType
    categories: list[PresetCategoryOut]
