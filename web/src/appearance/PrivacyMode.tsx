import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "hisaab.privacyMode";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

interface PrivacyModeValue {
  /** True while amounts are hidden. */
  hidden: boolean;
  toggle: () => void;
}

const PrivacyModeContext = createContext<PrivacyModeValue | null>(null);

/**
 * Private mode hides every amount (shown as "***"). Both the navbar switch and the dashboard's eye button use
 * this, so they always agree. Remembered by this browser.
 */
export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(readStored);

  const toggle = useCallback(() => {
    setHidden((was) => {
      try {
        localStorage.setItem(STORAGE_KEY, String(!was));
      } catch {
        // Not remembered, which is fine.
      }
      return !was;
    });
  }, []);

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);
  return <PrivacyModeContext.Provider value={value}>{children}</PrivacyModeContext.Provider>;
}

export function usePrivacyMode(): PrivacyModeValue {
  const value = useContext(PrivacyModeContext);
  if (!value) throw new Error("usePrivacyMode needs PrivacyModeProvider");
  return value;
}
