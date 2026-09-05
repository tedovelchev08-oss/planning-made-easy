import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { ArrowRight, CalendarDays, ChevronDown, Heart, Users } from "lucide-react";
import { fmtDateShort, fmtMoney } from "../../lib/data";
import { useMediaQuery, usePrefersReducedMotion } from "../../lib/store";
import { Stars } from "../ui";
import { SAMPLE_PLANNER } from "./sample";

const HeroScene = lazy(() => import("../three/HeroScene"));

function CursorGlow() {
  const reduced = usePrefersReducedMotion();
  const fine = useMediaQuery("(pointer: fine)");
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-600);
  const y = useMotionValue(-600);
  const sx = useSpring(x, { stiffness: 42, damping: 16, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 42, damping: 16, mass: 0.6 });

  useEffect(() => {
    if (reduced || !fine) return;
    const on = (e: PointerEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, [reduced, fine, x, y]);

  if (reduced || !fine) return null;
  return <motion.div ref={ref} className="cursor-glow" style={{ x: sx, y: sy }} aria-hidden="true" />;
}

function GlassPlannerCard({ tilt }: { tilt: boolean }) {
  const reduced = usePrefersReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 60, damping: 14 });
  const sry = useSpring(ry, { stiffness: 60, damping: 14 });
  const [hover, setHover] = useState(false);

  const pct = SAMPLE_PLANNER.progressPct;
  const C = 2 * Math.PI * 17;

  return (
    <motion.div
      style={tilt && !reduced ? { rotateX: srx, rotateY: sry, transformPerspective: 900 } : undefined}
      onPointerMove={tilt && !reduced ? (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 10);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
      } : undefined}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => { setHover(false); rx.set(0); ry.set(0); }}
      className="relative w-full rounded-[2rem] border border-white/65 bg-white/30 p-6 shadow-glass backdrop-blur-2xl sm:p-7"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/50 via-transparent to-blush/20" aria-hidden="true" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-blush-deep">
            <Heart size={11} fill="#E98BA0" className="text-blush-deep" /> The Luma planner
          </span>
          <motion.span
            animate={hover && !reduced ? { scale: [1, 1.25, 1] } : {}}
            transition={{ duration: 0.5 }}
            className="rounded-full bg-blush-soft px-2 py-0.5 text-[0.62rem] font-bold text-blush-deep"
          >
            ON TRACK
          </motion.span>
        </div>

        <h3 className="mt-3 font-display text-[1.65rem] leading-tight text-ink">
          Plan Your<br /><em className="text-blush-deep">Dream Wedding</em>
        </h3>

        <div className="hairline my-4" />

        <div className="space-y-3.5">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush-soft text-blush-deep"><CalendarDays size={15} /></span>
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-ink-mute">The date</p>
              <p className="font-semibold text-ink">{fmtDateShort(SAMPLE_PLANNER.date)}</p>
            </div>
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[0.7rem] font-bold text-ink-2">
              <Users size={12} className="text-blush-deep" /> {SAMPLE_PLANNER.guests} guests
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between text-[0.7rem] font-bold">
              <span className="uppercase tracking-[0.16em] text-ink-mute">Budget</span>
              <span className="text-ink">{fmtMoney(SAMPLE_PLANNER.remaining)} <span className="text-ink-mute">left</span></span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/8">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${SAMPLE_PLANNER.committedPct}%` }}
                transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                className="h-full rounded-full bg-gradient-to-r from-blush to-blush-deep"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0">
              <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
                <circle cx="22" cy="22" r="17" fill="none" stroke="rgb(51 43 49 / 0.1)" strokeWidth="4.5" />
                <motion.circle
                  cx="22" cy="22" r="17" fill="none" stroke="#E98BA0" strokeWidth="4.5" strokeLinecap="round"
                  strokeDasharray={C}
                  initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct / 100) }}
                  transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[0.62rem] font-extrabold text-ink">{pct}%</span>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-ink">Planning progress</p>
              <p className="text-[0.72rem] text-ink-mute">{SAMPLE_PLANNER.tasksDone} of {SAMPLE_PLANNER.tasksTotal} moments arranged</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-ink/90 px-4 py-3 text-cream">
          <div className="flex items-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blush text-[0.62rem] font-extrabold text-ink ring-2 ring-ink">M</span>
            <span className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-blush-deep text-[0.62rem] font-extrabold text-cream ring-2 ring-ink">T</span>
            <span className="ml-2.5 text-[0.72rem] font-semibold text-cream/80">2 planning · {SAMPLE_PLANNER.confirmed} said yes</span>
          </div>
          <Link to="/planner" className="inline-flex items-center gap-1 text-[0.72rem] font-bold text-blush transition hover:gap-2">
            Open <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function Hero() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const reduced = usePrefersReducedMotion();

  const scrollToHow = () => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" });

  return (
    <section className="relative overflow-hidden" aria-label="Introduction">
      {/* 3D installation */}
      <div className="absolute inset-0" aria-hidden="true">
        <Suspense fallback={null}>
          <HeroScene
            lite={!isDesktop}
            reduced={reduced}
            offsetX={isDesktop ? 2.7 : 0}
            offsetY={isDesktop ? 0.09 : -0.98}
          />
        </Suspense>
      </div>

      <CursorGlow />

      {/* mobile readability wash over the ambient scene */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[78svh] lg:hidden"
        style={{
          background:
            "radial-gradient(120% 85% at 50% 0%, rgba(255,248,240,0.94) 0%, rgba(255,248,240,0.62) 46%, rgba(255,248,240,0) 78%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col px-5 pt-28 sm:px-8 lg:min-h-[104vh] lg:flex-row lg:items-center lg:gap-10 lg:pt-24">
        {/* copy */}
        <div className="max-w-xl lg:w-[46%]">
          <motion.p
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-blush-deep"
          >
            <span className="h-px w-9 bg-blush-deep/60" /> A calmer way to plan a wedding
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 font-display text-[2.9rem] leading-[1.04] tracking-tight text-ink sm:text-6xl xl:text-[4.6rem]"
          >
            Plan the feeling.
            <span className="mt-2 block italic text-blush-deep">Not just the wedding.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 max-w-md text-[1.05rem] leading-relaxed text-ink-2"
          >
            Luma turns the moving parts of your wedding into one beautiful, intelligent
            workspace, from the first guest to the final dance.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Link
              to="/planner"
              className="group inline-flex items-center gap-2.5 rounded-full bg-ink px-8 py-4 text-[0.95rem] font-bold text-cream shadow-lift transition-all duration-300 hover:bg-ink/85 hover:shadow-glass active:scale-[0.97]"
            >
              Start planning
              <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <button
              onClick={scrollToHow}
              className="group inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white/40 px-7 py-4 text-[0.95rem] font-bold text-ink backdrop-blur transition-all duration-300 hover:border-ink/45 hover:bg-white/70 cursor-pointer"
            >
              Explore how it works
              <ChevronDown size={16} className="transition-transform duration-300 group-hover:translate-y-0.5" />
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 1 }}
            className="mt-9 flex items-center gap-3.5"
          >
            <div className="flex -space-x-2">
              {[["MK", "bg-blush"], ["SR", "bg-blush-soft"], ["PD", "bg-parchment"], ["AL", "bg-blush-deep/70"]].map(([t, c]) => (
                <span key={t} className={`flex h-8 w-8 items-center justify-center rounded-full ${c} text-[0.58rem] font-extrabold text-ink ring-2 ring-cream`}>{t}</span>
              ))}
            </div>
            <div>
              <Stars />
              <p className="mt-0.5 font-display text-[0.82rem] italic text-ink-2">Made for modern couples, not spreadsheets.</p>
            </div>
          </motion.div>
        </div>

        {/* glass planner card */}
        <motion.div
          initial={{ opacity: 0, y: 44, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto mt-12 w-full max-w-[400px] lg:mt-0 lg:ml-auto lg:w-[380px]"
        >
          <div className={reduced ? "" : "anim-bob"}>
            <GlassPlannerCard tilt={isDesktop} />
          </div>
        </motion.div>
      </div>

      {/* scroll cue */}
      <motion.button
        onClick={scrollToHow}
        aria-label="Scroll to how it works"
        className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-ink-mute transition hover:text-ink lg:flex cursor-pointer"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
      >
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em]">Scroll</span>
        <motion.span
          animate={reduced ? {} : { y: [0, 7, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown size={15} />
        </motion.span>
      </motion.button>
    </section>
  );
}
