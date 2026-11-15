import React, { Suspense, useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./lib/store";
import { I18nProvider } from "./lib/i18n";
import Home from "./pages/Home";
import { arrivedFromResetLink, arrivedWithLinkError } from "./lib/supabase";
import AuthLinks from "./components/AuthLinks";
import CookieNotice from "./components/CookieNotice";
import { lazyPage } from "./lib/lazyPage";
import {
  CheckoutModal, CheckoutReturnGate, ErrorBoundary, OnboardingModal, ToastHost, UpgradeModal,
} from "./components/ui";

/*
 * Only the landing page ships with the first download. Every other screen
 * arrives when it is opened: a guest gets the invitation, a visitor the
 * sign-in card, and the planner's pages come one at a time.
 */
const GuestInvite = lazyPage(() => import("./pages/GuestInvite"));
const NotFound = lazyPage(() => import("./pages/NotFound"));
const LegalPage = lazyPage(() => import("./pages/LegalPage"));
const SignInPage = lazyPage(() => import("./pages/Auth").then((m) => ({ default: m.SignInPage })));
const BeginPage = lazyPage(() => import("./pages/Auth").then((m) => ({ default: m.BeginPage })));
const ForgottenPasswordPage = lazyPage(() => import("./pages/Auth").then((m) => ({ default: m.ForgottenPasswordPage })));
const NewPasswordPage = lazyPage(() => import("./pages/Auth").then((m) => ({ default: m.NewPasswordPage })));
const Shell = lazyPage(() => import("./components/dashboard/Shell"));
const PlannerGate = lazyPage(() => import("./components/dashboard/PlannerGate"));
const Overview = lazyPage(() => import("./components/dashboard/Overview"));
const Guests = lazyPage(() => import("./components/dashboard/Guests"));
const Budget = lazyPage(() => import("./components/dashboard/Budget"));
const Timeline = lazyPage(() => import("./components/dashboard/Timeline"));
const Vendors = lazyPage(() => import("./components/dashboard/Vendors"));
const Seating = lazyPage(() => import("./components/dashboard/Seating"));
const Registry = lazyPage(() => import("./components/dashboard/Registry"));
const PageHub = lazyPage(() => import("./components/dashboard/PageHub"));

/** /planner/page?tab=… → /planner/invitation, keeping which tab was asked for */
function OldPageLink() {
  const { search } = useLocation();
  return <Navigate to={`/planner/invitation${search}`} replace />;
}

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
        <AuthLinks reset={arrivedFromResetLink} linkError={arrivedWithLinkError} />
        <SkipLink />
        <div className="ambient-mesh" aria-hidden="true" />
        <div className="grain-overlay" aria-hidden="true" />
        {/* a render crash anywhere below shows the styled fallback instead of
            a blank document — and is reported, never swallowed */}
        <ErrorBoundary>
          <Localised>
            {/* while a screen's code arrives the page ground shows, for a moment */}
            <Suspense fallback={null}>
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
                <Route path="invitation" element={<PageHub />} />
                {/* the wedding page became the invitation (Oct 2026): old links still land */}
                <Route path="page" element={<OldPageLink />} />
                <Route path="*" element={<Overview />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
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
