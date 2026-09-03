import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { FEATURES } from "../../lib/data";
import { IMAGES } from "../../lib/images";
import { FeatureIcon, Reveal } from "../ui";

/* ------------------------------ marquee band ------------------------------ */

function Marquee() {
  const words = ["Guest Flow", "Budget Clarity", "Timeline", "Vendor Hub", "Seating Studio", "Invitations", "Wedding Website", "Registry"];
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center" aria-hidden={key === "b"}>
      {words.map((w) => (
        <span key={w} className="flex items-center">
          <span className="px-7 font-display text-sm italic tracking-wide text-cream/85">{w}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#D4AF37" aria-hidden="true">
            <path d="M12 20.6S4.9 16 2.7 11.9C1.3 9.2 3 5.9 6.2 5.9c2 0 3.3 1.1 4 2.2h3.6c.7-1.1 2-2.2 4-2.2 3.2 0 4.9 3.3 3.5 6-2.2 4.1-9.3 8.7-9.3 8.7z" />
          </svg>
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative z-10 overflow-hidden border-y border-gold/25 bg-ink py-3.5">
      <div className="flex w-max" style={{ animation: "ticker 30s linear infinite" }}>
        {row("a")}{row("b")}
      </div>
    </div>
  );
}

/* ------------------------------ feature micro-visuals ------------------------------ */

function MiniGuests() {
  return (
    <div className="mt-6 flex items-center gap-3 overflow-hidden">
      <div className="flex -space-x-2.5">
        {[["AO", "bg-blush-soft text-blush-deep"], ["LB", "bg-sage-soft text-sage-deep"], ["SK", "bg-lav-soft text-lav-deep"], ["+9", "bg-gold-soft text-gold-deep"]].map(([t, c]) => (
          <span key={t} className={`flex h-9 w-9 items-center justify-center rounded-full ${c} text-[0.62rem] font-extrabold ring-2 ring-white transition-transform duration-500 group-hover:-translate-y-0.5`}>{t}</span>
        ))}
      </div>
      <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[0.62rem] font-bold text-sage-deep transition-transform duration-500 group-hover:translate-x-1">RSVP · yes</span>
      <span className="hidden rounded-full bg-blush-soft px-2.5 py-1 text-[0.62rem] font-bold text-blush-deep transition-transform duration-700 group-hover:translate-x-2 sm:block">Meal · risotto</span>
    </div>
  );
}

function MiniBudget() {
  return (
    <div className="mt-6">
      <div className="flex h-3 overflow-hidden rounded-full bg-ink/8">
        <span className="h-full w-[30%] rounded-l-full bg-gold transition-all duration-700 group-hover:w-[34%]" />
        <span className="h-full w-[42%] bg-blush transition-all duration-700 group-hover:w-[40%]" />
        <span className="h-full w-[12%] bg-sage transition-all duration-700" />
      </div>
      <div className="mt-2.5 flex justify-between text-[0.66rem] font-bold">
        <span className="text-ink-mute">paid · committed · pending</span>
        <span className="text-sage-deep">$8,420 left</span>
      </div>
    </div>
  );
}

function MiniTimeline() {
  return (
    <ul className="mt-6 space-y-2">
      {["Confirm final menu", "Send RSVP reminder", "Choose first dance"].map((t, i) => (
        <li key={t} className="flex items-center gap-2.5 text-[0.78rem] font-semibold text-ink-2">
          <span className={`flex h-4.5 w-4.5 h-[18px] w-[18px] items-center justify-center rounded-full ${i === 0 ? "bg-sage text-ink" : "border border-ink/20 bg-white text-transparent transition group-hover:text-sage-deep group-hover:border-sage"}`}>
            <Check size={10} strokeWidth={3.4} />
          </span>
          <span className={i === 0 ? "text-ink-mute line-through decoration-sage" : ""}>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function MiniVendors() {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <span className="rounded-full bg-sage-soft px-3 py-1.5 text-[0.66rem] font-bold text-sage-deep transition-transform duration-500 group-hover:-translate-y-0.5">Booked · Aria Studio</span>
      <span className="rounded-full bg-blush-soft px-3 py-1.5 text-[0.66rem] font-bold text-blush-deep transition-transform duration-700 group-hover:-translate-y-1">Proposal · Peony & Stem</span>
      <span className="rounded-full border border-dashed border-gold/50 bg-gold-soft/50 px-3 py-1.5 text-[0.66rem] font-bold text-gold-deep">Contract ✓</span>
    </div>
  );
}

function MiniSeating() {
  return (
    <div className="mt-6 flex items-center gap-4">
      <div className="relative h-16 w-16 transition-transform duration-700 group-hover:rotate-[30deg]">
        <span className="absolute inset-2 rounded-full border-2 border-dashed border-gold/50 bg-white/70" />
        {[0, 60, 120, 180, 240, 300].map((a) => {
          const r = (a * Math.PI) / 180;
          return <span key={a} className="absolute h-3.5 w-3.5 rounded-full bg-blush ring-2 ring-white" style={{ left: `calc(50% + ${Math.cos(r) * 26}px - 7px)`, top: `calc(50% + ${Math.sin(r) * 26}px - 7px)` }} />;
        })}
      </div>
      <p className="text-[0.72rem] font-semibold leading-relaxed text-ink-mute">drag · drop ·<br />breathe</p>
    </div>
  );
}

/* ------------------------------ features section ------------------------------ */

export function Features() {
  const card = (idx: number, spanCls: string, radiusCls: string) => {
    const f = FEATURES[idx];
    return (
      <Reveal key={f.id} delay={idx * 0.06} className={spanCls}>
        <article className={`group relative h-full overflow-hidden border border-white/70 bg-white/45 p-7 backdrop-blur-md transition-all duration-500 hover:-translate-y-1.5 hover:bg-white/75 hover:shadow-lift ${radiusCls}`}>
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blush/15 blur-2xl transition-opacity duration-500 group-hover:opacity-100 lg:opacity-0" aria-hidden="true" />
          <div className="flex items-start justify-between">
            <span className="flex h-14 w-14 items-center justify-center rounded-[1.1rem] border border-white/80 bg-white/70 shadow-sm transition-transform duration-500 group-hover:scale-105 group-hover:rotate-2">
              <FeatureIcon name={f.icon} className="h-8 w-8" />
            </span>
            <ArrowRight size={16} className="text-ink/20 transition-all duration-500 group-hover:translate-x-1 group-hover:text-gold-deep" />
          </div>
          <h3 className="mt-5 font-display text-[1.45rem] text-ink">{f.title}</h3>
          <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-2">{f.body}</p>
          {f.id === "guests" && <MiniGuests />}
          {f.id === "budget" && <MiniBudget />}
          {f.id === "timeline" && <MiniTimeline />}
          {f.id === "vendors" && <MiniVendors />}
          {f.id === "seating" && <MiniSeating />}
        </article>
      </Reveal>
    );
  };

  return (
    <section id="features" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32">
      <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_1fr]">
        <Reveal>
          <p className="flex items-center gap-3 text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-gold-deep">
            <span className="h-px w-9 bg-gold/70" /> The suite
          </p>
          <h2 className="mt-5 font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
            Everything the day needs.<br /><em className="text-blush-deep">Nothing it doesn't.</em>
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="max-w-md text-[1.02rem] leading-relaxed text-ink-2 lg:ml-auto">
            Six instruments that play together — so the plan stays as warm as the
            reason you're making it.
          </p>
        </Reveal>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-6">
        {card(0, "md:col-span-3", "rounded-[2rem] rounded-tr-[4.5rem]")}
        {card(1, "md:col-span-3", "rounded-[2rem] rounded-tl-[4.5rem]")}
        {card(2, "md:col-span-2", "rounded-[2rem] rounded-br-[4rem]")}
        {card(3, "md:col-span-2", "rounded-[2rem] rounded-bl-[4rem]")}
        {card(4, "md:col-span-2", "rounded-[2rem] rounded-tr-[4rem]")}

        {/* Wedding World banner */}
        <Reveal className="md:col-span-6" delay={0.1}>
          <article className="group relative overflow-hidden rounded-[2.2rem] border border-white/70 bg-gradient-to-r from-white/60 via-blush-soft/60 to-lav-soft/70 p-7 backdrop-blur-md transition-all duration-500 hover:-translate-y-1.5 hover:shadow-lift sm:p-9">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <span className="flex h-14 w-14 items-center justify-center rounded-[1.1rem] border border-white/80 bg-white/70 shadow-sm">
                  <FeatureIcon name="world" className="h-8 w-8" />
                </span>
                <h3 className="mt-5 font-display text-[1.7rem] text-ink">Wedding World</h3>
                <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-ink-2">{FEATURES[5].body}</p>
              </div>
              <div className="relative mx-auto w-full max-w-md">
                <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-card transition-transform duration-700 group-hover:rotate-1 group-hover:scale-[1.02]">
                  <div className="flex items-center gap-1.5 border-b border-ink/8 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blush" /><span className="h-2.5 w-2.5 rounded-full bg-gold" /><span className="h-2.5 w-2.5 rounded-full bg-sage" />
                    <span className="ml-3 rounded-full bg-ink/5 px-2.5 py-0.5 text-[0.62rem] font-bold text-ink-mute">maya-theo.luma.love</span>
                  </div>
                  <div className="relative h-40 overflow-hidden">
                    <img src={IMAGES.hands} alt="Maya and Theo's wedding website hero" className="h-full w-full object-cover transition-transform duration-[2.5s] group-hover:scale-110" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
                    <p className="absolute bottom-3 left-4 font-display text-xl italic text-cream">Maya & Theo — 10.17</p>
                  </div>
                </div>
                <span className="absolute -right-2 -top-3 rounded-full bg-ink px-3 py-1.5 text-[0.62rem] font-bold text-cream shadow-lift">RSVP · 84 yes</span>
              </div>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------ how it works ------------------------------ */

const STEPS = [
  {
    n: "01", title: "Set your world",
    body: "Add your date, people, priorities and celebration details. Luma shapes a workspace around the two of you.",
    accent: "ten minutes, not ten tabs",
  },
  {
    n: "02", title: "Make decisions",
    body: "Track money, guests, vendors and tasks without hunting through spreadsheets. Every number knows its story.",
    accent: "one calm source of truth",
  },
  {
    n: "03", title: "Bring it to life",
    body: "Send invitations, launch your website and enjoy the countdown while Luma keeps the details in tune.",
    accent: "guests feel it immediately",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[3rem] bg-ink px-7 py-16 sm:px-14 sm:py-20">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blush/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-lav/20 blur-3xl" aria-hidden="true" />
        <svg className="pointer-events-none absolute right-10 top-10 h-24 w-24 text-gold/30 anim-spin-slow" viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <circle cx="50" cy="50" r="34" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 8" />
          <circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="1" />
        </svg>

        <Reveal>
          <p className="flex items-center gap-3 text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-gold">
            <span className="h-px w-9 bg-gold/70" /> How it works
          </p>
          <h2 className="mt-5 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight text-cream sm:text-5xl">
            Three movements,<br /><em className="text-blush">one calm score.</em>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-3 lg:gap-8">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.14}>
              <div className="relative lg:border-l lg:border-cream/10 lg:pl-8">
                <span
                  className="absolute -top-9 right-0 font-display text-[5.2rem] leading-none text-transparent lg:-top-12 lg:text-[6.5rem]"
                  style={{ WebkitTextStroke: "1px rgb(255 181 194 / 0.45)" }}
                  aria-hidden="true"
                >
                  {s.n}
                </span>
                <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.24em] text-gold">Step {s.n}</p>
                <h3 className="mt-3 font-display text-[1.8rem] text-cream">{s.title}</h3>
                <p className="mt-3 max-w-xs text-[0.95rem] leading-relaxed text-cream/65">{s.body}</p>
                <p className="mt-4 font-display text-[0.95rem] italic text-blush">— {s.accent}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3} className="mt-16 flex flex-col items-center gap-3 text-center">
          <motion.span
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold"
            animate={{ y: [0, 5, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          >
            <ArrowRight size={18} className="rotate-90" />
          </motion.span>
          <p className="text-[0.85rem] font-semibold text-cream/60">The average couple sets up their world in one quiet evening.</p>
        </Reveal>
      </div>
    </section>
  );
}

export { Marquee };
