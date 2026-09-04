import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Lock, X } from "lucide-react";
import { TESTIMONIALS, TIERS, fmtMoney } from "../../lib/data";
import { useMediaQuery } from "../../lib/store";
import { Pill, Reveal, Stars } from "../ui";

/* ------------------------------ pricing ------------------------------ */

export function Pricing() {
  const navigate = useNavigate();
  // The marketing page never touches the store: choosing a tier enters the
  // product, where checkout and the server-granted entitlement actually happen.
  const choose = () => navigate("/planner");
  return (
    <section id="pricing" className="relative scroll-mt-28 overflow-hidden px-5 py-24 sm:px-8 sm:py-32">
      <div className="pointer-events-none absolute right-[-10%] top-10 h-96 w-96 rounded-full bg-blush/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-0 left-[-8%] h-80 w-80 rounded-full bg-blush/20 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <p className="flex items-center gap-3 text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-blush-deep">
              <span className="h-px w-9 bg-blush-deep/60" /> Pricing
            </p>
            <h2 className="mt-5 font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
              One beautiful <em className="text-blush-deep">purchase.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="max-w-md text-[1.02rem] leading-relaxed text-ink-2 lg:ml-auto">
              <strong className="text-ink">No monthly subscription. Ever.</strong> Pay once and every
              tool is yours for the whole journey — engagement to thank-you notes.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid items-stretch gap-6 lg:grid-cols-3">
          {TIERS.map((tier, i) => {
            const featured = !!tier.featured;
            return (
              <Reveal key={tier.id} delay={i * 0.1} className={featured ? "lg:-translate-y-5" : ""}>
                <article
                  className={`relative flex h-full flex-col overflow-hidden rounded-[2rem] p-8 transition-all duration-500 hover:-translate-y-2 ${
                    featured
                      ? "border border-blush-deep/50 bg-ink text-cream shadow-glass"
                      : "border border-white/70 bg-white/55 backdrop-blur-md hover:shadow-lift hover:bg-white/80"
                  }`}
                >
                  {featured && (
                    <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blush-deep px-4 py-1.5 text-[0.64rem] font-extrabold uppercase tracking-[0.2em] text-cream shadow-card">
                      Most loved
                    </span>
                  )}
                  {tier.id === "luxe" && (
                    <span className="absolute right-6 top-6"><Pill tone="pending">Luxe</Pill></span>
                  )}

                  <h3 className={`font-display text-[1.55rem] ${featured ? "text-cream" : "text-ink"}`}>{tier.name}</h3>
                  <p className={`mt-1.5 text-[0.88rem] leading-relaxed ${featured ? "text-cream/60" : "text-ink-2"}`}>{tier.blurb}</p>

                  <div className="mt-7 flex items-baseline gap-2">
                    <span className={`font-display text-[3.2rem] leading-none ${featured ? "text-cream" : "text-ink"}`}>{fmtMoney(tier.price)}</span>
                    <span className={`text-[0.8rem] font-bold ${featured ? "text-blush" : "text-ink-mute"}`}>one-time</span>
                  </div>

                  <div className={`hairline my-6 ${featured ? "opacity-60" : ""}`} />

                  <ul className="flex-1 space-y-3">
                    {tier.features.map((f) => {
                      const excluded = f.startsWith("No ");
                      return (
                        <li key={f} className={`flex items-start gap-2.5 text-[0.9rem] ${excluded ? (featured ? "text-cream/35 line-through" : "text-ink-mute/70 line-through") : featured ? "text-cream/85" : "text-ink-2"}`}>
                          <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${excluded ? "bg-transparent border border-current opacity-50" : featured ? "bg-blush-deep text-cream" : "bg-blush-soft text-blush-deep"}`}>
                            {excluded ? <X size={10} strokeWidth={3} /> : <Check size={10} strokeWidth={3.4} />}
                          </span>
                          {f}
                        </li>
                      );
                    })}
                  </ul>

                  <button
                    onClick={choose}
                    className={`mt-8 w-full cursor-pointer rounded-full py-3.5 text-[0.92rem] font-bold transition-all duration-300 active:scale-[0.97] ${
                      featured
                        ? "bg-blush-deep text-cream hover:brightness-110 hover:shadow-lift"
                        : "border border-ink/20 text-ink hover:border-ink/50 hover:bg-ink hover:text-cream"
                    }`}
                  >
                    Choose {tier.id === "essential" ? "Essential" : tier.id === "celebration" ? "Celebration" : "Luxe"}
                  </button>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.2}>
          <p className="mt-10 flex flex-wrap items-center justify-center gap-2 text-center text-[0.78rem] font-semibold text-ink-mute">
            <Lock size={13} className="text-blush-deep" />
            Secure checkout via Stripe · entitlement granted server-side · lifetime access · 14-day happiness promise
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------ testimonials ------------------------------ */

function QuoteBlock({ t, big = false, className = "" }: { t: (typeof TESTIMONIALS)[number]; big?: boolean; className?: string }) {
  return (
    <figure className={`relative ${className}`}>
      <span className="pointer-events-none absolute -left-3 -top-9 font-display text-[7rem] leading-none text-blush/35 select-none" aria-hidden="true">“</span>
      <Stars className="relative" />
      <blockquote className={`relative mt-4 font-display leading-snug text-ink ${big ? "text-[1.9rem] sm:text-[2.4rem]" : "text-[1.35rem] sm:text-[1.6rem]"}`}>
        {t.quote}
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <span className="h-px w-8 bg-blush-deep/70" aria-hidden="true" />
        <span className="text-[0.88rem] font-extrabold text-ink">{t.names}</span>
        <span className="text-[0.82rem] font-semibold text-ink-mute">· {t.city}</span>
      </figcaption>
    </figure>
  );
}

export function Stories() {
  const isMd = useMediaQuery("(min-width: 768px)");
  const [idx, setIdx] = useState(0);
  const next = () => setIdx((i) => (i + 1) % TESTIMONIALS.length);
  const prev = () => setIdx((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);

  return (
    <section id="stories" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32">
      <Reveal>
        <p className="flex items-center gap-3 text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-blush-deep">
          <span className="h-px w-9 bg-blush-deep/60" /> Love notes
        </p>
        <h2 className="mt-5 font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
          Couples kept <em className="text-blush-deep">the calm.</em>
        </h2>
      </Reveal>

      {isMd ? (
        <div className="mt-16 grid grid-cols-12 gap-x-10 gap-y-20">
          <Reveal className="col-span-7"><QuoteBlock t={TESTIMONIALS[0]} big /></Reveal>
          <Reveal className="col-span-5 mt-24" delay={0.15}><QuoteBlock t={TESTIMONIALS[1]} /></Reveal>
          <Reveal className="col-span-5 -mt-6" delay={0.1}><QuoteBlock t={TESTIMONIALS[2]} /></Reveal>
          <Reveal className="col-span-7 mt-14" delay={0.2}><QuoteBlock t={TESTIMONIALS[3]} big /></Reveal>
        </div>
      ) : (
        <div className="mt-12">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/50 p-8 backdrop-blur-md">
            <AnimatePresence mode="wait">
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <QuoteBlock t={TESTIMONIALS[idx]} big />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <div className="flex gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} aria-label={`Story ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${i === idx ? "w-7 bg-blush-deep" : "w-2 bg-ink/20 hover:bg-ink/40"}`} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={prev} aria-label="Previous story" className="rounded-full border border-ink/15 p-2.5 text-ink-2 transition hover:border-ink/40 hover:text-ink cursor-pointer"><ChevronLeft size={15} /></button>
              <button onClick={next} aria-label="Next story" className="rounded-full border border-ink/15 p-2.5 text-ink-2 transition hover:border-ink/40 hover:text-ink cursor-pointer"><ChevronRight size={15} /></button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
