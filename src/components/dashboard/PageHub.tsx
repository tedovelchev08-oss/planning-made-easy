import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useApp, usePrefersReducedMotion } from "../../lib/store";
import Invitations, { RsvpTracker, ShareCard } from "./Invitations";

/* ------------------------------------------------------------------ */
/* The invitation: the one page guests open. Choosing and sharing it,  */
/* and the replies it brings back. (It used to sit beside a separate   */
/* wedding website; the invitation now does that job on its own.)     */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: "invitation", label: "The invitation" },
  { id: "replies", label: "Replies" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** ?tab= as older links wrote it (rsvp, rsvps, website) */
const tabOf = (p: string | null): TabId => (p === "replies" || p === "rsvp" || p === "rsvps" ? "replies" : "invitation");

export default function PageHub() {
  const { db } = useApp();
  const reduced = usePrefersReducedMotion();
  const [params, setParams] = useSearchParams();
  const paramTab = params.get("tab");
  const [tab, setTab] = useState<TabId>(() => tabOf(paramTab));

  // keep the tab and the ?tab= param in sync (deep links, back/forward)
  useEffect(() => { setTab(tabOf(paramTab)); }, [paramTab]);

  const changeTab = (t: TabId) => {
    setTab(t);
    setParams(t === "invitation" ? {} : { tab: t }, { replace: true });
  };

  const unsynced = db.rsvpLog.filter((e) => !e.synced).length;
  const replied = db.guests.filter((g) => g.rsvp !== "pending").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[40px] leading-none sm:text-[46px]">Invitation</h1>
          <p className="mt-2 text-[15px] text-[var(--pl-ink-2)]">
            {db.invitation.live
              ? <>Open to guests. <span className="tabular-nums text-[var(--pl-ink)]">{replied} of {db.guests.length}</span> have replied.</>
              : "Not open yet: only the two of you can see it."}
          </p>
        </div>
        <div role="tablist" aria-label="Invitation" className="pl-seg">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => changeTab(t.id)}>
              {t.label}
              {t.id === "replies" && unsynced > 0 && (
                <span className={`ml-1.5 tabular-nums ${tab === t.id ? "text-[var(--pl-gold)]" : "text-[var(--pl-bronze)]"}`}>· {unsynced} new</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          {tab === "invitation" ? <><ShareCard /><Invitations /></> : <RsvpTracker />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
