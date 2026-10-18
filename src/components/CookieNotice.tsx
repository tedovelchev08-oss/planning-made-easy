import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "../lib/store";

/**
 * A small, honest note about what Luma stores (Block 20).
 *
 * Luma sets no cookies and uses only storage it needs to work (see the
 * cookie policy), so there is nothing to accept or reject: this tells
 * visitors so, once, and remembers that they've seen it. It is not a
 * consent banner, and it must never become one that pretends there's a
 * choice.
 *
 * Not shown on a guest's invitation (#/invite): that page is the couple's
 * design, and guests only answer an RSVP there.
 */
export const NOTICE_KEY = "luma.notice.cookies";

function seen(): boolean {
  try { return localStorage.getItem(NOTICE_KEY) === "1"; } catch { return false; }
}

export default function CookieNotice() {
  const { pathname } = useLocation();
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);

  // after the first paint, so it never competes with the page loading
  useEffect(() => {
    const t = window.setTimeout(() => setOpen(!seen()), 600);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(NOTICE_KEY, "1"); } catch { /* private mode: shown again next visit */ }
  };

  const inPlanner = pathname.startsWith("/planner") || pathname.startsWith("/demo");
  if (pathname.startsWith("/invite")) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="region"
          aria-label="About cookies"
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={`fixed left-4 right-4 z-[70] max-w-sm rounded-2xl border border-ink/10 bg-cream p-5 text-ink shadow-glass sm:left-5 sm:right-auto
            ${inPlanner ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-5" : "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:bottom-5"}`}
        >
          <p className="text-[0.88rem] leading-relaxed text-ink-2">
            <strong className="font-bold text-ink">No tracking here.</strong> Luma doesn't use cookies. It only keeps what it needs on your
            device, like your sign-in and your planner, so it works.{" "}
            <Link to="/cookies" className="font-bold text-ink underline underline-offset-2">Cookie policy</Link>
          </p>
          <button
            type="button" onClick={dismiss}
            className="mt-4 w-full rounded-xl bg-ink py-2.5 text-[0.86rem] font-bold text-cream transition hover:bg-ink/90 cursor-pointer"
          >
            Got it
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
