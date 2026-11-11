"""The categories a new user can start with.

Names, grouping and colours follow ezBookkeeping's preset categories (src/consts/category.ts, MIT). Icons are
Material Design Icons names, chosen to match. A colour of None draws in the text colour, as ezBookkeeping's
black does, so it shows in both light and dark themes.
"""

from dataclasses import dataclass, field

from app.categories.models import CategoryType


@dataclass(frozen=True)
class Preset:
    name: str
    icon: str
    color: str | None = None
    sub_categories: tuple["Preset", ...] = field(default=())


def _group(name: str, icon: str, color: str | None, *subs: tuple[str, str]) -> Preset:
    """A top-level preset whose sub-categories share its colour."""
    return Preset(name, icon, color, tuple(Preset(sub, sub_icon, color) for sub, sub_icon in subs))


EXPENSE = (
    _group("Food & Drink", "silverware-fork-knife", "#ff6b22",
           ("Food", "food"), ("Drink", "coffee"), ("Fruit & Snack", "food-apple")),
    _group("Clothing & Appearance", "hanger", "#673ab7",
           ("Clothing", "tshirt-crew"), ("Jewelry", "diamond-stone"), ("Cosmetic", "lipstick"),
           ("Hair Cuts & Salon", "content-cut")),
    _group("Housing & Houseware", "home", None,
           ("Houseware", "sofa"), ("Electronics", "television"), ("Repairs & Maintenance", "hammer-wrench"),
           ("Housekeeping Services", "broom"), ("Utilities Expense", "lightning-bolt"),
           ("Rent & Mortgage", "home-city")),
    _group("Transportation", "car", "#009688",
           ("Public Transit", "bus"), ("Taxi & Car Rental", "taxi"), ("Personal Car Expense", "car-wrench"),
           ("Train Tickets", "train"), ("Airline Tickets", "airplane")),
    _group("Communication", "phone", "#2196f3",
           ("Telephone Bill", "cellphone"), ("Internet Bill", "wifi"), ("Express Fee", "package-variant-closed")),
    _group("Entertainment", "party-popper", "#ff2d55",
           ("Sports & Fitness", "dumbbell"), ("Party Expense", "glass-cocktail"), ("Movies & Shows", "movie-open"),
           ("Toys & Games", "gamepad-variant"), ("Subscriptions", "autorenew"), ("Pet Expense", "paw"),
           ("Travelling", "bag-suitcase")),
    _group("Education & Studying", "school", "#cddc39",
           ("Books & Newspaper & Magazines", "book-open-variant"), ("Training Courses", "human-male-board"),
           ("Certification & Examination", "certificate")),
    _group("Gifts & Donations", "gift", "#4cd964",
           ("Gifts", "gift-outline"), ("Donations", "hand-heart")),
    _group("Medical & Healthcare", "medical-bag", "#ff3b30",
           ("Diagnosis & Treatment", "stethoscope"), ("Medications", "pill"), ("Medical Devices", "heart-pulse")),
    _group("Finance & Insurance", "bank", "#ff9500",
           ("Tax Expense", "file-percent"), ("Service Charge", "cash-minus"), ("Insurance Expense", "shield-check"),
           ("Interest Expense", "percent"), ("Compensation & Fine", "gavel")),
    _group("Miscellaneous", "dots-horizontal-circle", "#8e8e93",
           ("Other Expense", "dots-horizontal")),
)  # fmt: skip

INCOME = (
    _group("Occupational Earnings", "briefcase", "#ff6b22",
           ("Salary Income", "cash"), ("Bonus Income", "trophy"), ("Overtime Pay", "clock-plus-outline"),
           ("Side Job Income", "laptop")),
    _group("Finance & Investment", "chart-line", "#ff9500",
           ("Investment Income", "trending-up"), ("Rental Income", "home-account"), ("Interest Income", "percent")),
    _group("Miscellaneous", "dots-horizontal-circle", "#8e8e93",
           ("Gift & Lucky Money", "wallet-giftcard"), ("Winnings Income", "trophy-variant"), ("Windfall", "clover"),
           ("Other Income", "dots-horizontal")),
)  # fmt: skip

TRANSFER = (
    _group("General Transfer", "bank-transfer", "#ff6b22",
           ("Bank Transfer", "bank-transfer"), ("Credit Card Repayment", "credit-card"),
           ("Deposits & Withdrawals", "cash-multiple")),
    _group("Loan & Debt", "handshake", "#ff9500",
           ("Borrowing Money", "hand-coin"), ("Lending Money", "hand-extended"), ("Repayment", "cash-refund"),
           ("Debt Collection", "cash-check")),
    _group("Miscellaneous", "dots-horizontal-circle", "#8e8e93",
           ("Out-of-Pocket Expense", "wallet"), ("Reimbursement", "receipt"), ("Other Transfer", "dots-horizontal")),
)  # fmt: skip

# In the order the sign-up page shows them.
PRESETS: dict[CategoryType, tuple[Preset, ...]] = {
    CategoryType.EXPENSE: EXPENSE,
    CategoryType.INCOME: INCOME,
    CategoryType.TRANSFER: TRANSFER,
}
