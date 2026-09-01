import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarHeart, ChevronLeft, ChevronRight, Clock3, Heart, Inbox } from "lucide-react";
import { PHASES, Task, toDayKey } from "../../lib/data";
import { useApp, usePrefersReducedMotion } from "../../lib/store";
import { playChime } from "../../lib/sound";

const dayKeyOf = (d: Date) => toDayKey(d.toISOString());

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

interface DayInfo {
  tasks: Task[];
  wedding: boolean;
  deadline: boolean;
}

/**
 * The interactive planning calendar — every task with a due date, the RSVP
 * deadline and the wedding day itself are marked. Tap any day to see what
 * the plan holds for it, and tick tasks off right from here.
 */
export default function CalendarCard() {
  const { db, patch } = useApp();
  const reduced = usePrefersReducedMotion();
  const today = new Date();
  const todayIso = dayKeyOf(today);

  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(todayIso);

  const deadlineIso = useMemo(() => {
    const d = new Date(db.wedding.date);
    d.setDate(d.getDate() - 30);
    return dayKeyOf(d);
  }, [db.wedding.date]);

  const byDay = useMemo(() => {
    const m = new Map<string, DayInfo>();
    const get = (k: string) => {
      let e = m.get(k);
      if (!e) { e = { tasks: [], wedding: false, deadline: false }; m.set(k, e); }
      return e;
    };
    db.tasks.forEach((t) => { if (t.due) get(toDayKey(t.due)).tasks.push(t); });
    get(toDayKey(db.wedding.date)).wedding = true;
    get(deadlineIso).deadline = true;
    return m;
  }, [db.tasks, db.wedding.date, deadlineIso]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const arr: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= daysIn; d++) arr.push(dayKeyOf(new Date(month.getFullYear(), month.getMonth(), d)));
    return arr;
  }, [month]);

  const shiftMonth = (n: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  const sel = byDay.get(selected);
  const selDate = new Date(`${selected}T12:00:00`);
  const selLabel = selDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const toggle = (t: Task) => {
    playChime(t.done ? "undo" : "done");
    patch({ tasks: db.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) });
  };

  const phaseLabel = (p: Task["phase"]) => PHASES.find((x) => x.id === p)?.label ?? "";
  const who = (t: Task) =>
    t.assignee === "A" ? db.wedding.partnerA : t.assignee === "T" ? db.wedding.partnerB : "Both";

  const hasAnything = (info?: DayInfo) => !!info && (info.tasks.length > 0 || info.wedding || info.deadline);

  return (
    <section className="rounded-[1.8rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md" aria-label="Planning calendar">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg text-ink">
          <CalendarHeart size={17} className="text-blush-deep" /> The calendar
        </h3>
        <div className="flex items-center gap-1.5">
          {!isCurrentMonth && (
            <button
              onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(todayIso); }}
              className="rounded-full bg-gold-soft px-3 py-1.5 text-[0.64rem] font-extrabold uppercase tracking-wide text-gold-deep transition hover:brightness-105 cursor-pointer"
            >
              Today
            </button>
          )}
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="rounded-full p-1.5 text-ink-mute transition hover:bg-ink/5 hover:text-ink cursor-pointer"><ChevronLeft size={16} /></button>
          <span className="min-w-[7.5rem] text-center text-[0.85rem] font-extrabold text-ink">
            {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" className="rounded-full p-1.5 text-ink-mute transition hover:bg-ink/5 hover:text-ink cursor-pointer"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center" role="grid" aria-label={month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}>
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-ink-mute">{d}</span>
        ))}
        {cells.map((dayIso, i) => {
          if (!dayIso) return <span key={`x${i}`} aria-hidden="true" />;
          const info = byDay.get(dayIso);
          const isSel = dayIso === selected;
          const isToday = dayIso === todayIso;
          const marked = hasAnything(info);
          const n = dayIso.slice(8);
          return (
            <button
              key={dayIso}
              role="gridcell"
              onClick={() => setSelected(dayIso)}
              aria-label={`${new Date(`${dayIso}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })}${marked ? " — has plan items" : ""}`}
              aria-pressed={isSel}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-[0.8rem] font-bold transition-all duration-200 cursor-pointer ${
                isSel
                  ? "bg-ink text-cream shadow-card scale-[1.04]"
                  : marked
                  ? "bg-white/80 text-ink hover:bg-white hover:shadow-sm"
                  : "text-ink-2 hover:bg-white/70"
              } ${isToday && !isSel ? "ring-2 ring-gold/70" : ""}`}
            >
              {n}
              <span className="mt-0.5 flex h-1.5 items-center gap-[3px]">
                {info?.wedding && <Heart size={7} fill={isSel ? "#FFB5C2" : "#E98BA0"} className={isSel ? "text-blush" : "text-blush-deep"} />}
                {info?.deadline && !info.wedding && <span className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-lav" : "bg-lav-deep"}`} />}
                {info && info.tasks.filter((t) => !t.done).slice(0, 2).map((t) => (
                  <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-gold" : "bg-gold-deep"}`} />
                ))}
                {info && info.tasks.some((t) => t.done) && info.tasks.every((t) => t.done) && (
                  <span className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-sage" : "bg-sage-deep/70"}`} />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* selected day */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selected}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 rounded-2xl border border-ink/8 bg-cream/70 p-4"
          aria-live="polite"
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-[1.02rem] text-ink">{selLabel}</p>
            {selected === db.wedding.date && <span className="rounded-full bg-blush-soft px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-wide text-blush-deep">The day</span>}
            {selected === deadlineIso && <span className="rounded-full bg-lav-soft px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-wide text-lav-deep">RSVP deadline</span>}
          </div>

          {!sel || !hasAnything(sel) ? (
            <p className="mt-3 text-[0.85rem] font-semibold text-ink-mute">
              A quiet day. <span className="font-display italic text-ink-2">Nothing scheduled — perhaps a date night.</span>
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sel.wedding && (
                <li className="flex items-center gap-3 rounded-xl bg-blush-soft/70 px-3.5 py-2.5">
                  <Heart size={15} fill="#E98BA0" className="text-blush-deep" />
                  <span className="flex-1 text-[0.88rem] font-extrabold text-ink">The wedding day</span>
                  <span className="font-display text-[0.8rem] italic text-blush-deep">at last</span>
                </li>
              )}
              {sel.deadline && (
                <li className="flex items-center gap-3 rounded-xl bg-lav-soft/70 px-3.5 py-2.5">
                  <Inbox size={15} className="text-lav-deep" />
                  <span className="flex-1 text-[0.88rem] font-extrabold text-ink">RSVP deadline</span>
                  <span className="text-[0.68rem] font-bold text-lav-deep">30 days out</span>
                </li>
              )}
              {sel.tasks.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => toggle(t)}
                    aria-pressed={t.done}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-300 cursor-pointer ${
                      t.done ? "border-sage/50 bg-sage-soft/50" : "border-ink/10 bg-white/80 hover:border-gold/60 hover:shadow-sm"
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${t.done ? "border-sage-deep bg-sage-deep" : "border-ink/25 group-hover:border-gold"}`}>
                      {t.done && (
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#FFF8F0" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4.5 12.5l5 5 10-11" className="check-draw" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[0.86rem] font-bold ${t.done ? "text-ink-mute line-through decoration-sage-deep/50" : "text-ink"}`}>{t.title}</span>
                      <span className="text-[0.66rem] font-semibold text-ink-mute">{phaseLabel(t.phase)} · {who(t)}</span>
                    </span>
                    {selected === todayIso && !t.done && (
                      <span className="flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[0.58rem] font-extrabold uppercase tracking-wide text-gold-deep"><Clock3 size={9} /> today</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.62rem] font-bold text-ink-mute">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-gold-deep" /> task due</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sage-deep/70" /> all done</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-lav-deep" /> RSVP deadline</span>
        <span className="flex items-center gap-1.5"><Heart size={8} fill="#E98BA0" className="text-blush-deep" /> wedding day</span>
      </div>
    </section>
  );
}
