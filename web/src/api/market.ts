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
