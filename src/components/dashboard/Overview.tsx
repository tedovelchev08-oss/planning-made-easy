import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { ArrowRight, Check, Flower2, Heart, MapPin, Sparkles } from "lucide-react";
import { greeting, useApp, useCountUp, usePrefersReducedMotion, useStats } from "../../lib/store";
import { fmtDate, fmtMoney } from "../../lib/data";
import { Reveal } from "../ui";

function StatCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Reveal className={className}>
      <div className="group h-full rounded-[1.6rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-white/85 hover:shadow-lift">
        {children}
      </div>
    </Reveal>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const shown = useCountUp(pct);
  const C = 2 * Math.PI * 30;
  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
        <circle cx="36" cy="36" r="30" fill="none" stroke="rgb(51 43 49 / 0.08)" strokeWidth="7" />
        <motion.circle
          cx="36" cy="36" r="30" fill="none" stroke="#74996B" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct / 100) }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-xl text-ink">{shown}%</span>
    </div>
  );
}

export default function Overview() {
  const { db, patch, toast } = useApp();
  const stats = useStats();
  const reduced = usePrefersReducedMotion();

  const budgetLeft = useCountUp(stats.remaining);
  const confirmedShown = useCountUp(stats.confirmed);
  const daysShown = useCountUp(stats.days);

  const weekTasks = useMemo(() => db.tasks.filter((t) => t.week), [db.tasks]);
  const weekDone = weekTasks.filter((t) => t.done).length;
  const nextVendor = db.vendors.find((v) => v.status === "Proposal");
  const topBudget = [...db.budget].sort((a, b) => b.committed / Math.max(1, b.budget) - a.committed / Math.max(1, a.budget)).slice(0, 3);
  const gifted = db.registry.filter((r) => r.purchased).length;

  const toggleWeek = (id: string) => {
    const t = db.tasks.find((x) => x.id === id);
    const tasks = db.tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x));
    patch({ tasks });
    if (t && !t.done) {
      const all = weekTasks.every((w) => (w.id === id ? true : w.done));
      if (all) {
        toast("This week, handled", "Every focus task is done. Go be engaged.");
        if (!reduced) confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors: ["#FFB5C2", "#D4AF37", "#A8C5A0", "#C9B8E8", "#FFF8F0"] });
      }
    }
  };

  return (
    <div className="space-y-7">
      {/* greeting */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
              {greeting()}, <em className="text-blush-deep">{db.wedding.names}.</em>
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9rem] font-semibold text-ink-2">
              <span>{fmtDate(db.wedding.date)}</span>
              <span className="text-ink-mute">·</span>
              <span className="inline-flex items-center gap-1"><MapPin size={13} className="text-sage-deep" /> {db.wedding.venue}, {db.wedding.location}</span>
            </p>
          </div>
          <Link to="/planner/timeline" className="group inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/70 px-5 py-2.5 text-[0.84rem] font-bold text-ink transition hover:border-ink/40 hover:bg-white cursor-pointer">
            View full timeline <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </Reveal>

      {/* stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard>
          <div className="flex items-center gap-5">
            <ProgressRing pct={stats.progressPct} />
            <div>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-ink-mute">Planning progress</p>
              <p className="mt-1 font-display text-2xl text-ink">{stats.tasksDone}<span className="text-base text-ink-mute">/{stats.tasksTotal}</span></p>
              <p className="text-[0.72rem] font-semibold text-sage-deep">moments arranged</p>
            </div>
          </div>
        </StatCard>

        <StatCard>
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-ink-mute">Budget remaining</p>
          <p className="mt-2 font-display text-[2rem] leading-none text-ink">{fmtMoney(budgetLeft)}</p>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-ink/8">
            <motion.span initial={{ width: 0 }} animate={{ width: `${(stats.paid / stats.totalBudget) * 100}%` }} transition={{ duration: 1.3 }} className="bg-gold" />
            <motion.span initial={{ width: 0 }} animate={{ width: `${((stats.committed - stats.paid) / stats.totalBudget) * 100}%` }} transition={{ duration: 1.3, delay: 0.15 }} className="bg-blush" />
          </div>
          <p className="mt-2 text-[0.72rem] font-semibold text-ink-mute">
            <span className="text-gold-deep">{fmtMoney(stats.paid)} paid</span> · {fmtMoney(stats.committed - stats.paid)} committed
          </p>
        </StatCard>

        <StatCard>
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-ink-mute">Guests confirmed</p>
          <p className="mt-2 font-display text-[2rem] leading-none text-ink">
            {confirmedShown}<span className="text-base text-ink-mute"> / {stats.total}</span>
          </p>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-ink/8">
            <motion.span initial={{ width: 0 }} animate={{ width: `${(stats.confirmed / stats.total) * 100}%` }} transition={{ duration: 1.3 }} className="bg-sage" />
            <motion.span initial={{ width: 0 }} animate={{ width: `${(stats.pending / stats.total) * 100}%` }} transition={{ duration: 1.3, delay: 0.15 }} className="bg-blush" />
          </div>
          <p className="mt-2 text-[0.72rem] font-semibold text-ink-mute">{stats.pending} pending · {stats.declined} with love, no</p>
        </StatCard>

        <StatCard>
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-ink-mute">Countdown</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="font-display text-[2rem] leading-none text-ink">{daysShown}</p>
            <span className="text-sm font-bold text-ink-mute">days</span>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-cream">
            <Heart size={14} className="text-blush" fill="#FFB5C2" />
            <p className="text-[0.74rem] font-semibold">Every day closer is a good day.</p>
          </div>
        </StatCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* this week */}
        <Reveal>
          <section className="h-full rounded-[1.8rem] border border-white/70 bg-white/60 p-7 backdrop-blur-md" aria-label="This week">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-[1.5rem] text-ink">This week</h3>
                <p className="text-[0.78rem] font-semibold text-ink-mute">Four small yeses keep the whole plan calm.</p>
              </div>
              <span className="rounded-full bg-sage-soft px-3 py-1.5 text-[0.7rem] font-extrabold text-sage-deep">{weekDone}/{weekTasks.length} done</span>
            </div>

            <ul className="mt-6 space-y-2.5">
              {weekTasks.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => toggleWeek(t.id)}
                    aria-pressed={t.done}
                    className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all duration-300 cursor-pointer ${
                      t.done ? "border-sage/50 bg-sage-soft/60" : "border-ink/10 bg-white/70 hover:border-gold/50 hover:shadow-card"
                    }`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${t.done ? "border-sage-deep bg-sage-deep" : "border-ink/25 bg-white group-hover:border-gold"}`}>
                      {t.done && (
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#FFF8F0" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4.5 12.5l5 5 10-11" className="check-draw" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1">
                      <span className={`block text-[0.95rem] font-bold transition ${t.done ? "text-ink-mute line-through decoration-sage-deep/60" : "text-ink"}`}>{t.title}</span>
                      <span className="text-[0.7rem] font-semibold text-ink-mute">{t.assignee === "A" ? db.wedding.partnerA : t.assignee === "T" ? db.wedding.partnerB : "Together"} · this week</span>
                    </span>
                    {t.done && <Sparkles size={15} className="text-gold" />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        {/* side column */}
        <div className="space-y-5">
          {nextVendor && (
            <Reveal delay={0.08}>
              <section className="rounded-[1.8rem] border border-blush/40 bg-blush-soft/50 p-6 backdrop-blur-md" aria-label="Next decision">
                <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-blush-deep">Next decision</p>
                <h3 className="mt-2 font-display text-xl text-ink">{nextVendor.company}</h3>
                <p className="text-[0.8rem] font-semibold text-ink-2">{nextVendor.category} · {fmtMoney(nextVendor.price)} · proposal ready</p>
                <p className="mt-2 line-clamp-2 text-[0.82rem] leading-relaxed text-ink-2">{nextVendor.notes}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      patch({ vendors: db.vendors.map((v) => (v.id === nextVendor.id ? { ...v, status: "Booked", contract: true } : v)) });
                      toast(`${nextVendor.company} booked`, "Contract marked signed. Budget updated with the commitment.");
                    }}
                    className="flex-1 rounded-full bg-ink py-2.5 text-[0.8rem] font-bold text-cream transition hover:bg-ink/85 cursor-pointer"
                  >
                    Approve & book
                  </button>
                  <Link to="/planner/vendors" className="rounded-full border border-ink/15 px-4 py-2.5 text-[0.8rem] font-bold text-ink transition hover:border-ink/40">
                    Later
                  </Link>
                </div>
              </section>
            </Reveal>
          )}

          <Reveal delay={0.14}>
            <section className="rounded-[1.8rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md" aria-label="Budget pulse">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg text-ink">Budget pulse</h3>
                <Link to="/planner/budget" className="text-[0.74rem] font-bold text-gold-deep transition hover:underline">Open →</Link>
              </div>
              <ul className="mt-4 space-y-3.5">
                {topBudget.map((c) => (
                  <li key={c.id}>
                    <div className="flex justify-between text-[0.76rem] font-bold">
                      <span className="text-ink-2">{c.name}</span>
                      <span className="text-ink-mute">{Math.round((c.committed / Math.max(1, c.budget)) * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/8">
                      <motion.div initial={{ width: 0 }} whileInView={{ width: `${Math.min(100, (c.committed / Math.max(1, c.budget)) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 1.1 }} className="h-full rounded-full" style={{ background: c.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          <Reveal delay={0.2}>
            <section className="flex items-center gap-4 rounded-[1.8rem] border border-white/70 bg-gradient-to-br from-lav-soft/70 to-blush-soft/60 p-6 backdrop-blur-md">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-blush-deep shadow-sm"><Flower2 size={20} /></span>
              <div>
                <h3 className="font-display text-lg text-ink">Registry</h3>
                <p className="text-[0.78rem] font-semibold text-ink-2">{gifted} of {db.registry.length} gifts promised · guests adore the honeymoon fund</p>
              </div>
              <Check size={16} className="ml-auto text-sage-deep" />
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
