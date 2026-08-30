import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, Inbox, Mail } from "lucide-react";
import { useApp, usePrefersReducedMotion } from "../../lib/store";
import Invitations, { RsvpTracker, ShareCard } from "./Invitations";
import Website from "./Website";

/* ------------------------------------------------------------------ */
/* The Wedding Page — invitation, website and RSVPs merged into one   */
/* studio around a single guest-facing page.                          */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: "invitation", label: "Invitation", icon: Mail },
  { id: "website", label: "Website", icon: Globe },
  { id: "rsvps", label: "RSVPs", icon: Inbox },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PageHub() {
  const { db } = useApp();
  const reduced = usePrefersReducedMotion();
  const [params, setParams] = useSearchParams();
  const paramTab = params.get("tab");
  const [tab, setTab] = useState<TabId>(() =>
    paramTab === "rsvp" || paramTab === "rsvps" ? "rsvps" : paramTab === "website" ? "website" : "invitation");

  // keep the tab and the ?tab= param in sync (deep links, back/forward)
  useEffect(() => {
    if (paramTab === "rsvp" || paramTab === "rsvps") setTab("rsvps");
    else if (paramTab === "website") setTab("website");
    else if (paramTab === "invitation") setTab("invitation");
  }, [paramTab]);

  const changeTab = (t: TabId) => {
    setTab(t);
    setParams(t === "invitation" ? {} : { tab: t }, { replace: true });
  };

  const unsynced = db.rsvpLog.filter((e) => !e.synced).length;

  return (
    <div className="space-y-6">
      {/* header + tabs */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.22em] text-gold-deep">One link · one page</p>
          <h2 className="mt-1.5 font-display text-3xl tracking-tight text-ink sm:text-4xl">
            The wedding <em className="text-blush-deep">page</em>
          </h2>
          <p className="mt-2 max-w-lg text-[0.9rem] font-semibold text-ink-2">
            Your invitation opens it, your website completes it, and every RSVP lands in one tracker. Built in one place.
          </p>
        </div>

        <div
          role="tablist" aria-label="Wedding page sections"
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-ink/12 bg-white/70 p-1.5 backdrop-blur-md sm:self-auto"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id} role="tab" aria-selected={active}
                onClick={() => changeTab(t.id)}
                className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[0.8rem] font-extrabold transition-colors duration-300 cursor-pointer ${active ? "text-cream" : "text-ink-mute hover:text-ink"}`}
              >
                {active && !reduced && (
                  <motion.span
                    layoutId="pagehub-tab"
                    className="absolute inset-0 rounded-full bg-ink"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                {active && reduced && <span className="absolute inset-0 rounded-full bg-ink" />}
                <t.icon size={14} className="relative" />
                <span className="relative">{t.label}</span>
                {t.id === "rsvps" && unsynced > 0 && (
                  <motion.span
                    initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 20 }}
                    className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-blush-deep px-1 text-[0.6rem] font-extrabold text-white"
                  >
                    {unsynced} new
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* the one link guests receive */}
      <ShareCard />

      {/* tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "invitation" && <Invitations />}
          {tab === "website" && <Website />}
          {tab === "rsvps" && <RsvpTracker />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
