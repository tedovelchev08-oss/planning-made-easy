import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, CalendarClock, Heart, Lightbulb, X } from "lucide-react";
import { useApp, usePrefersReducedMotion } from "../../lib/store";
import { toDayKey } from "../../lib/data";
import {
  type Nudge, type NudgeState, hideNudge, loadNudgeState, nudgesFor, saveNudgeState, visibleNudges,
} from "../../lib/nudges";

/**
 * Reminders in the planner (Block 22): a bell with a count, a panel listing
 * what needs attention, and once a day a small card with the most
 * important one. Built from the couple's own plan (lib/nudges.ts); what
 * they hide is remembered on this device.
 */
const TONE: Record<Nudge["tone"], { icon: React.ReactNode; ring: string }> = {
  urgent: { icon: <AlertTriangle size={15} />, ring: "bg-blush-soft text-blush-deep" },
  attention: { icon: <CalendarClock size={15} />, ring: "bg-gold-soft text-gold-deep" },
  celebrate: { icon: <Heart size={15} />, ring: "bg-sage-soft text-sage-deep" },
  tip: { icon: <Lightbulb size={15} />, ring: "bg-lav-soft text-lav-deep" },
};

const today = () => toDayKey(new Date().toISOString());

function NudgeRow({ n, onGo, onHide }: { n: Nudge; onGo: () => void; onHide: () => void }) {
  return (
    <li className="flex gap-3 px-4 py-3.5">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE[n.tone].ring}`} aria-hidden="true">{TONE[n.tone].icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.88rem] font-bold leading-snug text-ink">{n.title}</p>
        <p className="mt-0.5 text-[0.8rem] leading-snug text-ink-2">{n.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {n.action && (
            <button onClick={onGo} className="text-[0.78rem] font-bold text-ink underline underline-offset-4 cursor-pointer">{n.action.label}</button>
          )}
          <button onClick={onHide} className="text-[0.78rem] font-semibold text-ink-mute transition hover:text-ink cursor-pointer">
            {n.once ? "Dismiss" : "Hide for today"}
          </button>
        </div>
      </div>
    </li>
  );
}

export default function Reminders() {
  const { db, weddingId } = useApp();
  const reduced = usePrefersReducedMotion();
  const navigate = useNavigate();
  const [state, setState] = useState<NudgeState>(() => loadNudgeState(weddingId));
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<Nudge | null>(null);
  const day = today();

  useEffect(() => { setState(loadNudgeState(weddingId)); }, [weddingId]);

  const all = useMemo(() => nudgesFor(db, day), [db, day]);
  const shown = visibleNudges(all, state, day);

  const update = (next: NudgeState) => { setState(next); saveNudgeState(weddingId, next); };
  const hide = (n: Nudge) => { update(hideNudge(state, n, day)); if (popup?.id === n.id) setPopup(null); };
  const go = (n: Nudge) => { setOpen(false); setPopup(null); if (n.action) navigate(n.action.to); };

  // once a day, the most important reminder gets a small card of its own
  const top = shown.find((n) => n.tone !== "tip");
  useEffect(() => {
    if (!top || state.popupDay === day) return;
    const t = window.setTimeout(() => {
      setPopup(top);
      update({ ...state, popupDay: day });
    }, 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top?.id, state.popupDay, day]);

  // the card says its piece and goes: it used to stay over the top of every
  // page until closed. The bell keeps the full list.
  const { pathname } = useLocation();
  const shownOn = useRef(pathname);
  useEffect(() => {
    if (!popup) return;
    shownOn.current = pathname;
    const t = window.setTimeout(() => setPopup(null), 9000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup]);
  useEffect(() => { if (pathname !== shownOn.current) setPopup(null); }, [pathname]);

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); setPopup(null); }}
        aria-label={shown.length ? `Reminders, ${shown.length} new` : "Reminders"} aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink-2 transition hover:border-ink/40 hover:text-ink cursor-pointer"
      >
        <Bell size={15} />
        {shown.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 text-[0.62rem] font-extrabold text-cream" aria-hidden="true">
            {shown.length > 9 ? "9+" : shown.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button className="fixed inset-0 z-40 cursor-default" exit={{ pointerEvents: "none" }} onClick={() => setOpen(false)} aria-label="Close reminders" />
            <motion.div
              role="dialog" aria-label="Reminders"
              initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-ink/10 bg-cream shadow-glass"
            >
              <div className="flex items-center justify-between border-b border-ink/8 px-4 py-3">
                <p className="text-[0.86rem] font-extrabold text-ink">Reminders</p>
                <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 text-ink-mute hover:text-ink cursor-pointer"><X size={15} /></button>
              </div>
              {shown.length ? (
                <ul className="max-h-[min(60vh,calc(100dvh-13rem))] divide-y divide-ink/8 overflow-y-auto">
                  {shown.map((n) => <NudgeRow key={n.id} n={n} onGo={() => go(n)} onHide={() => hide(n)} />)}
                </ul>
              ) : (
                <p className="px-4 py-6 text-center text-[0.84rem] text-ink-2">Nothing needs you right now.</p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {popup && !open && (
          <motion.aside
            role="status" aria-label="Reminder"
            initial={reduced ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="absolute right-0 top-12 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-ink/10 bg-cream p-1 shadow-glass"
          >
            <ul><NudgeRow n={popup} onGo={() => go(popup)} onHide={() => hide(popup)} /></ul>
            {shown.length > 1 && (
              <button onClick={() => { setPopup(null); setOpen(true); }} className="w-full border-t border-ink/8 px-4 py-2.5 text-left text-[0.78rem] font-bold text-ink-2 hover:text-ink cursor-pointer">
                See all {shown.length} reminders
              </button>
            )}
            <button onClick={() => setPopup(null)} aria-label="Close reminder" className="absolute right-2 top-2 rounded-full p-1 text-ink-mute hover:text-ink cursor-pointer"><X size={14} /></button>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
