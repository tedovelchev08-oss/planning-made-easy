import React, { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./lib/store";
import { I18nProvider } from "./lib/i18n";
import Home from "./pages/Home";
import GuestInvite from "./pages/GuestInvite";
import NotFound from "./pages/NotFound";
import Shell from "./components/dashboard/Shell";
import Overview from "./components/dashboard/Overview";
import Guests from "./components/dashboard/Guests";
import Budget from "./components/dashboard/Budget";
import Timeline from "./components/dashboard/Timeline";
import Vendors from "./components/dashboard/Vendors";
import Seating from "./components/dashboard/Seating";
import Registry from "./components/dashboard/Registry";
import PageHub from "./components/dashboard/PageHub";
import {
  AuthModal, CheckoutModal, CheckoutReturnGate, ErrorBoundary, OnboardingModal, ToastHost,
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
              <Route path="/demo" element={<DemoGate />} />
              <Route path="/planner" element={<Shell />}>
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
        <AuthModal />
        <CheckoutModal />
        {/* confirms the entitlement after returning from Stripe (B2) */}
        <CheckoutReturnGate />
        <OnboardingModal />
      </HashRouter>
    </AppProvider>
  );
}
