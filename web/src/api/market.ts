/** Index prices for the top bar. */

export interface MarketQuote {
  /** A stable key, such as "NIFTY". */
  symbol: string;
  /** What the top bar shows, such as "NIFTY 50". */
  name: string;
  /** Points, as the exchange publishes them. */
  price: number;
  /** Points since the previous close. */
  change: number;
  /** Percent since the previous close. */
  change_percent: number;
}

export interface MarketQuotes {
  quotes: MarketQuote[];
  /** False while the numbers are the samples below, not a live feed. */
  live: boolean;
}

/**
 * Sample numbers to lay the top bar out with.
 * TODO: replace with a WebSocket feed: the backend subscribes to a market data provider and pushes
 * `MarketQuote` updates; `useMarketQuotes` (components/MarketTicker.tsx) applies them as they arrive.
 */
export const SAMPLE_QUOTES: MarketQuote[] = [
  { symbol: "NIFTY", name: "NIFTY 50", price: 24_350.5, change: 112.35, change_percent: 0.46 },
  { symbol: "BANKNIFTY", name: "BANK NIFTY", price: 52_180.75, change: -84.2, change_percent: -0.16 },
  { symbol: "SENSEX", name: "SENSEX", price: 80_245.1, change: 356.8, change_percent: 0.45 },
];

/** A stock in the gainers or losers list. */
export interface MarketMover {
  symbol: string;
  name: string;
  price: number;
  change_percent: number;
}

/** A sector index's change today. */
export interface SectorChange {
  name: string;
  change_percent: number;
}

/** How many stocks rose, fell or stayed flat. */
export interface MarketBreadth {
  advances: number;
  declines: number;
  unchanged: number;
}

/**
 * Sample numbers for the Markets page, to lay it out with. Not real prices.
 * TODO: serve these from the backend, refreshed from the same market data feed as the quotes.
 */
export const SAMPLE_GAINERS: MarketMover[] = [
  { symbol: "TATAMOTORS", name: "Tata Motors", price: 982.4, change_percent: 3.12 },
  { symbol: "ADANIPORTS", name: "Adani Ports", price: 1_412.65, change_percent: 2.48 },
  { symbol: "INFY", name: "Infosys", price: 1_865.3, change_percent: 1.94 },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", price: 1_598.1, change_percent: 1.62 },
  { symbol: "LT", name: "Larsen & Toubro", price: 3_642.75, change_percent: 1.35 },
];

export const SAMPLE_LOSERS: MarketMover[] = [
  { symbol: "HDFCBANK", name: "HDFC Bank", price: 1_684.2, change_percent: -1.84 },
  { symbol: "ASIANPAINT", name: "Asian Paints", price: 2_456.9, change_percent: -1.42 },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", price: 1_758.35, change_percent: -1.15 },
  { symbol: "NESTLEIND", name: "Nestle India", price: 2_312.5, change_percent: -0.87 },
  { symbol: "SUNPHARMA", name: "Sun Pharma", price: 1_802.4, change_percent: -0.64 },
];

export const SAMPLE_SECTORS: SectorChange[] = [
  { name: "NIFTY IT", change_percent: 1.48 },
  { name: "NIFTY AUTO", change_percent: 1.12 },
  { name: "NIFTY METAL", change_percent: 0.74 },
  { name: "NIFTY PHARMA", change_percent: -0.32 },
  { name: "NIFTY FMCG", change_percent: -0.58 },
  { name: "NIFTY BANK", change_percent: -0.16 },
];

export const SAMPLE_BREADTH: MarketBreadth = { advances: 31, declines: 18, unchanged: 1 };
