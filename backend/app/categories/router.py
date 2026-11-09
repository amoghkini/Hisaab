from fastapi import APIRouter

from app.categories.schemas import PresetGroupOut
from app.categories.service import preset_groups

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])


@router.get("/presets")
def presets_route() -> list[PresetGroupOut]:
    """The preset categories a new account can start with. Public: the sign-up page shows them."""
    return preset_groups()
