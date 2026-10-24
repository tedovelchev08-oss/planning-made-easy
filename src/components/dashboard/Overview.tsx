import { useMemo } from "react";
import { Link } from "react-router-dom";
import confetti from "canvas-confetti";
import { useApp, usePrefersReducedMotion, useStats } from "../../lib/store";
import { playChime } from "../../lib/sound";
import { fmtDate, fmtMoney, timeAgo } from "../../lib/data";
import { greetingKey, useT } from "../../lib/i18n";
import CalendarCard from "./CalendarCard";

/**
 * Today. The week comes first, because that is what the two of you came to
 * do; where you stand follows as one short summary, then the decision that
 * is waiting and the latest replies.
 */

/** a share of a whole, as a width; never NaN when the whole is 0 */
const share = (part: number, whole: number) => `${whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0}%`;

function Stat({ label, value, of, children }: { label: string; value: string; of?: string; children: React.ReactNode }) {
  return (
    <div className="pl-row py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13.5px] text-[var(--pl-ink-2)]">{label}</span>
        <b className="font-display text-[24px] font-normal leading-none tabular-nums">
          {value}{of && <small className="ml-1.5 font-sans text-[13px] font-light text-[var(--pl-ink-2)]">of {of}</small>}
        </b>
      </div>
      <div className="pl-meter" aria-hidden="true">{children}</div>
    </div>
  );
}

export default function Overview() {
  const { db, patch, toast } = useApp();
  const { t } = useT();
  const stats = useStats();
  const reduced = usePrefersReducedMotion();
  const { partnerA, partnerB } = db.wedding;

  const weekTasks = useMemo(() => db.tasks.filter((x) => x.week), [db.tasks]);
  const weekDone = weekTasks.filter((x) => x.done).length;
  const weekLeft = weekTasks.length - weekDone;
  const nextVendor = db.vendors.find((v) => v.status === "Proposal");
  const who = (a: string) => (a === "A" ? partnerA : a === "T" ? partnerB : "Together");

  const toggleWeek = (id: string) => {
    const task = db.tasks.find((x) => x.id === id);
    patch({ tasks: db.tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) });
    playChime(task && !task.done ? "done" : "undo");
    if (task && !task.done && weekTasks.every((w) => (w.id === id ? true : w.done))) {
      playChime("sparkle");
      toast("This week, handled", "Every task for the week is done.");
      if (!reduced) confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#c9a86a", "#e6cd95", "#7a5c28", "#ede3cf"] });
    }
  };

  const summary = weekTasks.length === 0
    ? "Nothing is set for this week yet."
    : weekLeft === 0 ? "Everything for this week is done."
    : `${weekLeft} ${weekLeft === 1 ? "thing" : "things"} left this week.`;

  return (
    <div className="space-y-6">
      {/* on a phone the rail isn't there, so the couple open the page */}
      <div className="-mx-4 -mt-7 bg-[var(--pl-onyx)] px-5 pb-6 pt-5 text-[var(--pl-ivory)] sm:-mx-8 lg:hidden">
        <p className="font-display text-[34px] leading-none">
          {partnerA}{partnerB && <><i className="mx-1.5 font-accent text-[0.7em] text-[var(--pl-gold)]">&amp;</i>{partnerB}</>}
        </p>
        <p className="mt-2 font-accent text-[17px] italic text-[var(--pl-ivory)]/75">
          {fmtDate(db.wedding.date)} · <span className="text-[var(--pl-gold)]">{stats.days} days to go</span>
        </p>
      </div>

      <header>
        <h1 className="font-display text-[40px] leading-none sm:text-[46px]">{t(greetingKey())}</h1>
        <p className="mt-2 text-[15px] text-[var(--pl-ink-2)]">
          {summary} <span className="hidden lg:inline">{db.wedding.venue && `${db.wedding.venue}${db.wedding.location ? `, ${db.wedding.location}` : ""}.`}</span>
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          {/* this week */}
          <section className="pl-card" aria-labelledby="week-h">
            <div className="pl-card-h">
              <h2 id="week-h">This week</h2>
              {weekTasks.length > 0 && <small>{weekDone} of {weekTasks.length} done</small>}
            </div>
            {weekTasks.length === 0 ? (
              <p className="px-6 py-6 text-[15px] text-[var(--pl-ink-2)]">
                Choose a few tasks for the week on the <Link to="/planner/timeline" className="text-[var(--pl-bronze)] underline underline-offset-4">timeline</Link>, and they'll wait here.
              </p>
            ) : (
              <ul>
                {weekTasks.map((x) => (
                  <li key={x.id} className="pl-row">
                    <button
                      onClick={() => toggleWeek(x.id)} aria-pressed={x.done}
                      className="flex w-full items-center gap-4 px-6 py-4 text-left transition hover:bg-[rgb(28_26_23/.025)] cursor-pointer"
                    >
                      <span className={`pl-ring${x.done ? " is-done" : ""}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[15.5px] ${x.done ? "text-[var(--pl-ink-2)] line-through decoration-[rgb(28_26_23/.3)]" : ""}`}>{x.title}</span>
                        {x.due && <span className="block text-[12.5px] text-[var(--pl-ink-2)]">{x.done ? "done" : `due ${fmtDate(`${x.due}T12:00:00`, { weekday: "long", day: "numeric", month: "short" })}`}</span>}
                      </span>
                      <span className="pl-who">{who(x.assignee)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-[var(--pl-line)] px-6 py-3.5">
              <Link to="/planner/timeline" className="text-[13.5px] text-[var(--pl-bronze)] underline underline-offset-4">The whole timeline</Link>
            </div>
          </section>

          <CalendarCard />
        </div>

        <div className="space-y-5">
          {/* where you stand */}
          <section className="pl-card" aria-labelledby="stand-h">
            <div className="pl-card-h"><h2 id="stand-h">Where you stand</h2></div>
            <div className="px-6 pb-2">
              <Stat label="Guests who said yes" value={String(stats.confirmed)} of={String(stats.total)}>
                <span className="bg-[#7aa06a]" style={{ width: share(stats.confirmed, stats.total) }} />
                <span className="bg-[var(--pl-gold)]" style={{ width: share(stats.pending, stats.total) }} />
              </Stat>
              <Stat label="Budget left to commit" value={fmtMoney(stats.remaining)} of={fmtMoney(stats.totalBudget)}>
                <span className="bg-[var(--pl-ink)]" style={{ width: share(stats.paid, stats.totalBudget) }} />
                <span className="bg-[var(--pl-gold)]" style={{ width: share(stats.committed - stats.paid, stats.totalBudget) }} />
              </Stat>
              <Stat label="Plan arranged" value={String(stats.tasksDone)} of={String(stats.tasksTotal)}>
                <span className="bg-[var(--pl-bronze)]" style={{ width: `${stats.progressPct}%` }} />
              </Stat>
            </div>
            <p className="border-t border-[var(--pl-line)] px-6 py-3.5 text-[13px] text-[var(--pl-ink-2)]">
              {fmtMoney(stats.paid)} paid · {stats.pending} still to answer · {stats.declined} can't come
            </p>
          </section>

          {/* the decision that's waiting */}
          {nextVendor && (
            <section className="pl-card" aria-labelledby="decide-h">
              <div className="pl-card-h"><h2 id="decide-h">Waiting on you</h2><small>a proposal</small></div>
              <div className="px-6 py-5">
                <p className="font-display text-[22px] leading-tight">{nextVendor.company}</p>
                <p className="mt-1 text-[13.5px] text-[var(--pl-ink-2)]">{nextVendor.category} · {fmtMoney(nextVendor.price)}</p>
                {nextVendor.notes && <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[var(--pl-ink-2)]">{nextVendor.notes}</p>}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      patch({ vendors: db.vendors.map((v) => (v.id === nextVendor.id ? { ...v, status: "Booked", contract: true } : v)) });
                      toast(
                        `${nextVendor.company} booked`,
                        nextVendor.budgetId
                          ? `Contract signed — ${fmtMoney(nextVendor.price)} now committed in Budget.`
                          : "Contract signed. Link the vendor to a budget category to track its commitment.",
                      );
                    }}
                    className="h-11 flex-1 rounded-[2px] bg-[var(--pl-onyx)] text-[12px] font-medium uppercase tracking-[0.16em] text-[var(--pl-ivory)] transition hover:bg-[#2a2622] cursor-pointer"
                  >
                    Book them
                  </button>
                  <Link to="/planner/vendors" className="flex h-11 items-center rounded-[2px] border border-[var(--pl-line)] px-4 text-[13.5px] transition hover:border-[rgb(28_26_23/.35)]">
                    Later
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* the latest replies */}
          {db.rsvpLog.length > 0 && (
            <section className="pl-card" aria-labelledby="replies-h">
              <div className="pl-card-h">
                <h2 id="replies-h">Latest replies</h2>
                <Link to="/planner/invitation?tab=replies" className="text-[13px] text-[var(--pl-bronze)] underline underline-offset-4">All replies</Link>
              </div>
              <ul className="px-6 pb-2">
                {db.rsvpLog.slice(0, 4).map((e) => (
                  <li key={e.id} className="pl-row flex items-baseline gap-3 py-3 text-[14.5px]">
                    <span className={`h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${e.answer === "yes" ? "bg-[#7aa06a]" : "bg-[#b55a45]"}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{e.name} <span className="text-[var(--pl-ink-2)]">{e.answer === "yes" ? "is coming" : "can't make it"}</span></span>
                    <span className="shrink-0 text-[12.5px] text-[var(--pl-ink-2)]">{timeAgo(e.at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
