import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { AuthIllustration } from "@/components/AuthIllustration";
import { Logo } from "@/components/Logo";

interface AuthLayoutProps {
  /** Login keeps the form narrow with a wide illustration; sign-up swaps the widths for its two-column form. */
  variant: "login" | "signup";
  children: ReactNode;
}

/**
 * The ezBookkeeping auth layout: the logo in the top corner, artwork on a tinted panel, and the form on a
 * raised card. Below 960px the artwork goes and the card takes the page.
 */
export function AuthLayout({ variant, children }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <RouterLink to="/" className="auth-logo">
        <Logo />
        <span className="auth-app-title">Hisaab</span>
      </RouterLink>
      <div className={`auth-wrapper auth-wrapper--${variant}`}>
        <div className="auth-image-background">
          <AuthIllustration variant={variant} />
        </div>
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}
