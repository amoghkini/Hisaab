import { mdiChartAreaspline, mdiChartBoxOutline, mdiMenuDown, mdiMenuUp, mdiTrendingDown, mdiTrendingUp } from "@mdi/js";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useState, type ReactNode } from "react";

import { SAMPLE_BREADTH, SAMPLE_GAINERS, SAMPLE_LOSERS, SAMPLE_SECTORS, type MarketMover, type MarketQuote } from "@/api/market";
import { useMarketQuotes } from "@/components/MarketTicker";
import { MdiIcon } from "@/components/MdiIcon";

const PRICE = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CHANGE = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "always" });

const RANGES = ["1D", "1W", "1M", "6M", "1Y", "5Y"] as const;
type ChartRange = (typeof RANGES)[number];

function changeColor(value: number): string {
  return value >= 0 ? "success.main" : "error.main";
}

function Change({ percent, points }: { percent: number; points?: number }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", color: changeColor(percent), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      <MdiIcon path={percent >= 0 ? mdiMenuUp : mdiMenuDown} sx={{ fontSize: 20, mx: -0.5 }} />
      {points !== undefined ? `${CHANGE.format(points)} ` : ""}({CHANGE.format(percent)}%)
    </Box>
  );
}

function Card({ title, icon, children }: { title: string; icon?: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 2, sm: 2.5 }, py: 1.75 }}>
        {icon ? <MdiIcon path={icon} sx={{ fontSize: 20, color: "text.secondary" }} /> : null}
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>
      <Divider />
      {children}
    </Paper>
  );
}

function IndexCard({ quote }: { quote: MarketQuote }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, px: 2.5, py: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: "0.02em" }}>
        {quote.name}
      </Typography>
      <Typography sx={{ fontSize: "1.625rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", mt: 0.5 }}>{PRICE.format(quote.price)}</Typography>
      <Typography variant="body2" component="div">
        <Change percent={quote.change_percent} points={quote.change} />
      </Typography>
    </Paper>
  );
}

function MoversList({ movers }: { movers: MarketMover[] }) {
  return (
    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {movers.map((mover, index) => (
        <Box
          component="li"
          key={mover.symbol}
          sx={{ display: "flex", alignItems: "center", gap: 1.5, px: { xs: 2, sm: 2.5 }, py: 1.25, borderTop: index > 0 ? 1 : 0, borderColor: "divider" }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {mover.symbol}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {mover.name}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "end" }}>
            <Typography variant="body2" sx={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              ₹{PRICE.format(mover.price)}
            </Typography>
            <Typography variant="caption" component="div">
              <Change percent={mover.change_percent} />
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function BreadthFigure({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Box sx={{ textAlign: "center" }}>
      <Typography sx={{ fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.2, color }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

/**
 * Index prices, a chart, market trends and the day's top gainers and losers.
 * Placeholder: every number is a sample from api/market.ts.
 * TODO: live quotes over a WebSocket, a price chart per index and range, and movers and sectors from the backend.
 */
export function MarketsPage() {
  const { quotes, live } = useMarketQuotes();
  const [index, setIndex] = useState(quotes[0]?.symbol ?? "NIFTY");
  const [range, setRange] = useState<ChartRange>("1D");
  const chosen = quotes.find((quote) => quote.symbol === index);

  return (
    <>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" component="h1">
          Markets
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Indian market indices, trends and today's biggest movers.
        </Typography>
      </Box>

      {live ? null : (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          These are sample numbers, not real prices. Live charts and prices are coming in a later version of Hisaab.
        </Alert>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2, mb: 2.5 }}>
        {quotes.map((quote) => (
          <IndexCard key={quote.symbol} quote={quote} />
        ))}
      </Box>

      {/* The chart across the full width, then the movers and trends in a row below it. */}
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", mb: 2.5 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 1.5, px: { xs: 1, sm: 1.5 }, pr: { xs: 2, sm: 2.5 }, pb: { xs: 1.5, sm: 0 } }}>
          {/* On phones the ranges go on their own row, below the indices. */}
          <Tabs value={index} onChange={(_, next: string) => setIndex(next)} variant="scrollable" sx={{ flex: { xs: "1 1 100%", sm: 1 }, minWidth: 0 }}>
            {quotes.map((quote) => (
              <Tab key={quote.symbol} value={quote.symbol} label={quote.name} sx={{ fontWeight: 600 }} />
            ))}
          </Tabs>
          <ToggleButtonGroup exclusive size="small" value={range} onChange={(_, next: ChartRange | null) => next && setRange(next)} aria-label="Chart range" sx={{ ml: { xs: 1, sm: 0 } }}>
            {RANGES.map((each) => (
              <ToggleButton key={each} value={each} sx={{ px: 1.25, py: 0.25 }}>
                {each}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Divider />
        <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
          {/* The index's price on the left; the NIFTY 50's advances and declines on the right. */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2, flexWrap: "wrap" }}>
            {chosen ? (
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "1.375rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{PRICE.format(chosen.price)}</Typography>
                <Change percent={chosen.change_percent} points={chosen.change} />
              </Box>
            ) : (
              <Box />
            )}
            <Box role="group" aria-label="Market breadth, NIFTY 50" sx={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Market breadth · NIFTY 50
              </Typography>
              <BreadthFigure label="Advances" value={SAMPLE_BREADTH.advances} color="success.main" />
              <BreadthFigure label="Declines" value={SAMPLE_BREADTH.declines} color="error.main" />
              <BreadthFigure label="Unchanged" value={SAMPLE_BREADTH.unchanged} />
            </Box>
          </Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              height: { xs: 260, md: 420 },
              border: "2px dashed",
              borderColor: "divider",
              borderRadius: 2,
              color: "text.disabled",
              textAlign: "center",
              px: 2,
            }}
          >
            <MdiIcon path={mdiChartAreaspline} sx={{ fontSize: 44 }} />
            <Typography variant="body2">
              Live {chosen?.name ?? "index"} chart ({range}) is coming soon
            </Typography>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2.5 }}>
        <Card title="Top gainers · NIFTY 50" icon={mdiTrendingUp}>
          <MoversList movers={SAMPLE_GAINERS} />
        </Card>
        <Card title="Top losers · NIFTY 50" icon={mdiTrendingDown}>
          <MoversList movers={SAMPLE_LOSERS} />
        </Card>
        <Card title="Sector trends" icon={mdiChartBoxOutline}>
          <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
            {SAMPLE_SECTORS.map((sector, position) => (
              <Box
                component="li"
                key={sector.name}
                sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: { xs: 2, sm: 2.5 }, py: 1.25, borderTop: position > 0 ? 1 : 0, borderColor: "divider" }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {sector.name}
                </Typography>
                <Typography variant="body2" component="div">
                  <Change percent={sector.change_percent} />
                </Typography>
              </Box>
            ))}
          </Box>
        </Card>
      </Box>
    </>
  );
}
