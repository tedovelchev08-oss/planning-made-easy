import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider } from "./lib/store";
import Home from "./pages/Home";
import GuestInvite from "./pages/GuestInvite";
import Shell from "./components/dashboard/Shell";
import Overview from "./components/dashboard/Overview";
import Guests from "./components/dashboard/Guests";
import Budget from "./components/dashboard/Budget";
import Timeline from "./components/dashboard/Timeline";
import Vendors from "./components/dashboard/Vendors";
import Seating from "./components/dashboard/Seating";
import Registry from "./components/dashboard/Registry";
import PageHub from "./components/dashboard/PageHub";
import NotFound from "./pages/NotFound";
import { AuthModal, CheckoutModal, ToastHost } from "./components/ui";

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

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <ScrollToTop />
        <SkipLink />
        <div className="ambient-mesh" aria-hidden="true" />
        <div className="grain-overlay" aria-hidden="true" />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/invite" element={<GuestInvite />} />
          <Route path="/site" element={<Navigate to="/invite" replace />} />
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
        <ToastHost />
        <AuthModal />
        <CheckoutModal />
      </HashRouter>
    </AppProvider>
  );
}
