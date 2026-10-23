import React, { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppProvider, useApp } from "./lib/store";
import { I18nProvider } from "./lib/i18n";
import Home from "./pages/Home";
import GuestInvite from "./pages/GuestInvite";
import NotFound from "./pages/NotFound";
import LegalPage from "./pages/LegalPage";
import { BeginPage, ForgottenPasswordPage, NewPasswordPage, SignInPage } from "./pages/Auth";
import { arrivedFromResetLink, arrivedWithLinkError } from "./lib/supabase";
import CookieNotice from "./components/CookieNotice";
import Shell from "./components/dashboard/Shell";
import PlannerGate from "./components/dashboard/PlannerGate";
import Overview from "./components/dashboard/Overview";
import Guests from "./components/dashboard/Guests";
import Budget from "./components/dashboard/Budget";
import Timeline from "./components/dashboard/Timeline";
import Vendors from "./components/dashboard/Vendors";
import Seating from "./components/dashboard/Seating";
import Registry from "./components/dashboard/Registry";
import PageHub from "./components/dashboard/PageHub";
import {
  CheckoutModal, CheckoutReturnGate, ErrorBoundary, OnboardingModal, ToastHost, UpgradeModal,
} from "./components/ui";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function SkipLink() {
  return (
    <button
      onClick={() => {
        const main = document.querySelector("main");
        if (main instanceof HTMLElement) {
          main.tabIndex = -1;
          main.focus({ preventScroll: false });
          main.scrollIntoView();
        }
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-cream"
    >
      Skip to content
    </button>
  );
}

/**
 * Where an emailed link lands. A password-reset link signs the person in;
 * the next step is choosing the new password, not the homepage. An expired
 * or reused link says so on the sign-in page.
 */
function AuthLinks() {
  const navigate = useNavigate();
  useEffect(() => {
    if (arrivedFromResetLink) navigate("/new-password", { replace: true });
    else if (arrivedWithLinkError) navigate("/sign-in?link=expired", { replace: true });
  }, [navigate]);
  return null;
}

/** /demo only makes sense when the app actually booted in demo mode. */
function DemoGate() {
  const { mode } = useApp();
  if (mode === "cloud") return <Navigate to="/planner" replace />;
  return <Shell />;
}

/** Binds the i18n dictionary to the wedding record's locale. */
function Localised({ children }: { children: React.ReactNode }) {
  const { db } = useApp();
  return <I18nProvider locale={db.wedding.locale}>{children}</I18nProvider>;
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <ScrollToTop />
        <AuthLinks />
        <SkipLink />
        <div className="ambient-mesh" aria-hidden="true" />
        <div className="grain-overlay" aria-hidden="true" />
        {/* a render crash anywhere below shows the styled fallback instead of
            a blank document — and is reported, never swallowed */}
        <ErrorBoundary>
          <Localised>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/invite" element={<GuestInvite />} />
              <Route path="/privacy" element={<LegalPage doc="privacy" />} />
              <Route path="/terms" element={<LegalPage doc="terms" />} />
              <Route path="/refunds" element={<LegalPage doc="refunds" />} />
              <Route path="/cookies" element={<LegalPage doc="cookies" />} />
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/begin" element={<BeginPage />} />
              <Route path="/forgotten-password" element={<ForgottenPasswordPage />} />
              <Route path="/new-password" element={<NewPasswordPage />} />
              <Route path="/demo" element={<DemoGate />} />
              <Route path="/planner" element={<PlannerGate />}>
                <Route index element={<Overview />} />
                <Route path="guests" element={<Guests />} />
                <Route path="budget" element={<Budget />} />
                <Route path="timeline" element={<Timeline />} />
                <Route path="vendors" element={<Vendors />} />
                <Route path="seating" element={<Seating />} />
                <Route path="registry" element={<Registry />} />
                <Route path="page" element={<PageHub />} />
                <Route path="*" element={<Overview />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Localised>
        </ErrorBoundary>
        <ToastHost />
        <CookieNotice />
        <CheckoutModal />
        <UpgradeModal />
        {/* confirms the entitlement after returning from Stripe (B2) */}
        <CheckoutReturnGate />
        <OnboardingModal />
      </HashRouter>
    </AppProvider>
  );
}
