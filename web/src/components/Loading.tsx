import type { CSSProperties } from "react";

import { Logo } from "@/components/Logo";
import "@/components/loading.css";

/** Twelve rays, a twelfth of a turn apart, that make up the star. Ported from TabVault's loading-animation work. */
const RAYS = Array.from({ length: 12 }, (_, ray) => ray);

interface LoadingProps {
  /**
   * "page" sits in the middle of the space a list is about to fill; "small" is for panels, cards and dialogs;
   * "screen" fills the window with the logo above the star, for while the app itself starts.
   */
  size?: "page" | "small" | "screen";
  /** Read out by screen readers in place of the animation. */
  label?: string;
}

/**
 * The turning star on its own. With `size` (in pixels) it sits inside a button or icon button in place of its icon,
 * in the colour of the text around it; without, it is the theme-coloured star that Loading shows.
 */
export function Spinner({ size, style }: { size?: number; style?: CSSProperties }) {
  return (
    <span
      className={size === undefined ? "hk-spinner" : "hk-spinner hk-spinner-inline"}
      style={size === undefined ? style : ({ "--size": `${size}px`, "--ray": `${Math.max(1.5, size / 10)}px`, ...style } as CSSProperties)}
      aria-hidden="true"
    >
      {RAYS.map((ray) => (
        <span key={ray} style={{ "--i": ray } as CSSProperties} />
      ))}
    </span>
  );
}

/**
 * Shown while something loads, in the theme colour. It fades in only after a moment, so what loads quickly never
 * flashes it; with reduced motion on, the star stands still and pulses instead of turning.
 */
export function Loading({ size = "page", label = "Loading…" }: LoadingProps) {
  return (
    <div className={`hk-loading hk-loading-${size}`} role="status">
      {size === "screen" ? <Logo size={44} /> : null}
      <Spinner />
      <span className="hk-visually-hidden">{label}</span>
    </div>
  );
}
