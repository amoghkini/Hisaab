from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from app.auth.schemas import ThemeColor
from app.categories.models import CategoryType


class PresetCategoryOut(BaseModel):
    name: str
    icon: str
    color: str | None
    sub_categories: list["PresetCategoryOut"] = []


class PresetGroupOut(BaseModel):
    type: CategoryType
    categories: list[PresetCategoryOut]


class CategoryOut(BaseModel):
    """One of the user's categories, with its sub-categories when it is top-level."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    type: CategoryType
    parent_id: int | None
    name: str
    icon: str
    color: str | None
    hidden: bool
    display_order: int
    transaction_count: int = Field(description="Transactions in this category itself, not counting sub-categories.")
    sub_categories: list["CategoryOut"] = []


def _name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Enter a name for the category.")
    return value


Name = Annotated[str, Field(max_length=64), AfterValidator(_name)]
IconName = Annotated[str, Field(pattern=r"^[a-z0-9-]{1,64}$", description="A Material Design Icons name")]


class CategoryIn(BaseModel):
    """A new category. With `parent_id` it is a sub-category of that top-level category, and takes its type."""

    type: CategoryType
    parent_id: int | None = None
    name: Name
    icon: IconName
    color: ThemeColor | None = None


class CategoryUpdate(BaseModel):
    """Only the fields sent are changed. `parent_id` moves a sub-category to another group of the same type."""

    parent_id: int | None = None
    name: Name | None = None
    icon: IconName | None = None
    color: ThemeColor | None = None
    hidden: bool | None = None

    # These always have a value, so an explicit null is refused. parent_id null is refused too: a sub-category
    # cannot become top-level, so its transactions never end up in a group.
    @field_validator("parent_id", "name", "icon", "hidden")
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("Cannot be null.")
        return value

    def changes(self) -> dict[str, object]:
        return {name: getattr(self, name) for name in self.model_fields_set}


class CategoryOrderIn(BaseModel):
    """Every top-level category of one type (no `parent_id`), or every sub-category of one group, in the new order."""

    type: CategoryType
    parent_id: int | None = None
    ids: list[int] = Field(min_length=1, max_length=1000)
