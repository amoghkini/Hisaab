import "@fontsource-variable/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { PrivacyModeProvider } from "@/appearance/PrivacyMode";
import { ThemeColorProvider } from "@/appearance/ThemeColorProvider";
import { GuestOnly, RequireAuth } from "@/auth/session";
import { AppLayout } from "@/layouts/AppLayout";
import { AccountEnquiryPage } from "@/pages/accounts/AccountEnquiryPage";
import { AccountsPage } from "@/pages/accounts/AccountsPage";
import { CategoriesPage } from "@/pages/categories/CategoriesPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { MarketsPage } from "@/pages/markets/MarketsPage";
import { DataManagementPage } from "@/pages/settings/DataManagementPage";
import { PreferencesSettingsPage } from "@/pages/settings/PreferencesSettingsPage";
import { ProfileSettingsPage } from "@/pages/settings/ProfileSettingsPage";
import { SecuritySettingsPage } from "@/pages/settings/SecuritySettingsPage";
import { SettingsLayout } from "@/pages/settings/SettingsLayout";
import { SignupPage } from "@/pages/SignupPage";
import { TransactionsPage } from "@/pages/transactions/TransactionsPage";
import "@/styles.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Inside the query client: the theme colour comes from the signed-in user. */}
      <ThemeColorProvider>
        <PrivacyModeProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<GuestOnly />}>
                <Route path="login" element={<LoginPage />} />
                <Route path="signup" element={<SignupPage />} />
              </Route>
              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="accounts" element={<AccountsPage />} />
                  <Route path="accounts/:accountId" element={<AccountEnquiryPage />} />
                  <Route path="markets" element={<MarketsPage />} />
                  <Route path="settings" element={<SettingsLayout />}>
                    <Route index element={<Navigate to="profile" replace />} />
                    <Route path="profile" element={<ProfileSettingsPage />} />
                    <Route path="security" element={<SecuritySettingsPage />} />
                    <Route path="categories" element={<CategoriesPage />} />
                    <Route path="data" element={<DataManagementPage />} />
                    <Route path="preferences" element={<PreferencesSettingsPage />} />
                  </Route>
                  {/* Old addresses of pages that moved into the settings. */}
                  <Route path="profile" element={<Navigate to="/settings/profile" replace />} />
                  <Route path="categories" element={<Navigate to="/settings/categories" replace />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </PrivacyModeProvider>
      </ThemeColorProvider>
    </QueryClientProvider>
  </StrictMode>,
);
