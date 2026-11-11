import { mdiMenuDown, mdiMenuUp } from "@mdi/js";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { SAMPLE_QUOTES, type MarketQuote, type MarketQuotes } from "@/api/market";
import { MdiIcon } from "@/components/MdiIcon";

const PRICE = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CHANGE = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "always" });

/**
 * The index prices for the top bar.
 * TODO: open a WebSocket to the backend and merge each pushed quote into state by symbol; set `live` once connected.
 */
export function useMarketQuotes(): MarketQuotes {
  return { quotes: SAMPLE_QUOTES, live: false };
}

function Quote({ quote }: { quote: MarketQuote }) {
  const up = quote.change >= 0;
  const color = up ? "success.main" : "error.main";
  return (
    <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0 }}>
      <Typography component="span" sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
        {quote.name}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, whiteSpace: "nowrap" }}>
        <Typography component="span" sx={{ fontSize: "0.8125rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {PRICE.format(quote.price)}
        </Typography>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", color, fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
          <MdiIcon path={up ? mdiMenuUp : mdiMenuDown} sx={{ fontSize: 18, mx: -0.5 }} />
          {CHANGE.format(quote.change_percent)}%
        </Box>
      </Box>
    </Box>
  );
}

/** NIFTY 50, BANK NIFTY and SENSEX with their change today, beside the theme switch. Wide screens only. */
export function MarketTicker() {
  const { quotes, live } = useMarketQuotes();
  return (
    <Tooltip title={live ? "Live index prices" : "Sample prices: live prices are coming in a later version of Hisaab"}>
      <Box
        role="group"
        aria-label="Market indices"
        sx={{ display: { xs: "none", lg: "flex" }, alignItems: "center", gap: 3, mr: 1.5 }}
      >
        {quotes.map((quote) => (
          <Quote key={quote.symbol} quote={quote} />
        ))}
      </Box>
    </Tooltip>
  );
}
