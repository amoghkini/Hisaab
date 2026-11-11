// The icons an account can use, by Material Design Icons name (the backend stores the name).
// Each icon is imported by name so the bundle keeps only these.
import {
  mdiAccountCash,
  mdiAccountGroup,
  mdiBank,
  mdiBankTransfer,
  mdiBitcoin,
  mdiBriefcase,
  mdiCar,
  mdiCash,
  mdiCashClock,
  mdiCashLock,
  mdiCashMultiple,
  mdiCellphone,
  mdiCertificate,
  mdiChartLine,
  mdiChartPie,
  mdiCreditCard,
  mdiCreditCardChip,
  mdiFinance,
  mdiGold,
  mdiHandCoin,
  mdiHandshake,
  mdiHome,
  mdiPiggyBank,
  mdiQrcode,
  mdiSafe,
  mdiSchool,
  mdiShapeOutline,
  mdiShieldCheck,
  mdiStorefront,
  mdiTrendingUp,
  mdiWallet,
} from "@mdi/js";

const ICONS: Record<string, string> = {
  "wallet": mdiWallet,
  "cash": mdiCash,
  "cash-multiple": mdiCashMultiple,
  "bank": mdiBank,
  "piggy-bank": mdiPiggyBank,
  "safe": mdiSafe,
  "credit-card": mdiCreditCard,
  "credit-card-chip": mdiCreditCardChip,
  "cellphone": mdiCellphone,
  "qrcode": mdiQrcode,
  "bank-transfer": mdiBankTransfer,
  "cash-lock": mdiCashLock,
  "cash-clock": mdiCashClock,
  "certificate": mdiCertificate,
  "hand-coin": mdiHandCoin,
  "handshake": mdiHandshake,
  "account-cash": mdiAccountCash,
  "account-group": mdiAccountGroup,
  "chart-line": mdiChartLine,
  "chart-pie": mdiChartPie,
  "trending-up": mdiTrendingUp,
  "finance": mdiFinance,
  "gold": mdiGold,
  "bitcoin": mdiBitcoin,
  "shield-check": mdiShieldCheck,
  "home": mdiHome,
  "car": mdiCar,
  "school": mdiSchool,
  "briefcase": mdiBriefcase,
  "storefront": mdiStorefront,
};

/** Every account icon name, in the order the icon picker shows them. */
export const ACCOUNT_ICON_NAMES = Object.keys(ICONS);

/** The SVG path for an account icon name; a generic shape for a name this build does not know. */
export function accountIconPath(name: string): string {
  return ICONS[name] ?? mdiShapeOutline;
}

/** ezBookkeeping's account colours (src/consts/color.ts, MIT). Null draws in the text colour. */
export const ACCOUNT_COLORS: { name: string; value: string | null }[] = [
  { name: "Default", value: null },
  { name: "Gray", value: "#8e8e93" },
  { name: "Red", value: "#ff3b30" },
  { name: "Pink", value: "#ff2d55" },
  { name: "Deep Orange", value: "#ff6b22" },
  { name: "Orange", value: "#ff9500" },
  { name: "Yellow", value: "#ffcc00" },
  { name: "Lime", value: "#cddc39" },
  { name: "Teal", value: "#009688" },
  { name: "Green", value: "#4cd964" },
  { name: "Light Blue", value: "#5ac8fa" },
  { name: "Blue", value: "#2196f3" },
  { name: "Deep Purple", value: "#673ab7" },
  { name: "Purple", value: "#9c27b0" },
];
