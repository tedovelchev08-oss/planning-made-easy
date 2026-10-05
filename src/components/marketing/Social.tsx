import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { TESTIMONIALS } from "../../lib/data";
import { PLANS, PLAN_ORDER, formatPrice, type Plan } from "../../lib/plans";
import { useCurrency } from "../../lib/currency";
import { useNavigate } from "react-router-dom";
import { useApp, useMediaQuery } from "../../lib/store";
import { CurrencySelect, Pill, Reveal, Stars } from "../ui";

/* ------------------------------ pricing ------------------------------ */

/**
 * Free to start, two one-time upgrades. Plans, prices and feature lists all
 * come from lib/plans.ts; the currency is the visitor's to choose, and the
 * number is the same in each (€49 / $49 / £49) — never a conversion.
 */
export function Pricing() {
  const { openCheckout, setAuthOpen, user, mode } = useApp();
  const navigate = useNavigate();
  const [currency, setCurrency] = useCurrency();

  const choose = (plan: Plan) => {
    if (plan === "essential") {
      // the free plan is not bought: it starts the planner
      if (mode === "demo") navigate("/demo");
      else if (user) navigate("/planner");
      else setAuthOpen(true);
      return;
    }
    // a purchase attaches to a wedding, so it needs an account first
    if (mode === "cloud" && !user) { setAuthOpen(true); return; }
    openCheckout(plan);
  };

  return (
    <section id="pricing" className="relative scroll-mt-28 overflow-hidden px-5 py-24 sm:px-8 sm:py-32">
      <div className="pointer-events-none absolute right-[-10%] top-10 h-96 w-96 rounded-full bg-blush/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-0 left-[-8%] h-80 w-80 rounded-full bg-blush/20 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <p className="flex items-center gap-3 text-eyebrow font-extrabold uppercase tracking-label-x text-blush-deep">
              <span className="h-px w-9 bg-blush-deep/60" /> Pricing
            </p>
            <h2 className="mt-5 font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
              Start free. <em className="text-blush-deep">Upgrade once,</em> if you love it.
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="max-w-md text-lead leading-relaxed text-ink-2 lg:ml-auto">
              Plan your whole wedding on {PLANS.essential.name} for free. When you want every guest, every design
              and your own website, upgrade with <strong className="text-ink">one payment — no subscription, no recurring fees.</strong>
            </p>
            <CurrencySelect value={currency} onChange={setCurrency} className="mt-5 lg:ml-auto lg:flex lg:w-fit" />
          </Reveal>
        </div>

        <div className="mt-16 grid items-stretch gap-6 lg:grid-cols-3">
          {PLAN_ORDER.map((id, i) => {
            const plan = PLANS[id];
            const featured = !!plan.featured;
            const free = plan.price === 0;
            return (
              <Reveal key={id} delay={i * 0.1} className={featured ? "lg:-translate-y-5" : ""}>
                {/* The badge straddles the card's top edge, so it lives on this
                    wrapper rather than inside the card — the card clips its own
                    overflow to keep the 2rem radius, which cut the badge in half. */}
                <div className="relative h-full">
                {featured && (
                  <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-blush-deep px-4 py-1.5 text-eyebrow font-extrabold uppercase tracking-label-wide text-cream shadow-card">
                    Recommended
                  </span>
                )}
                <article
                  aria-label={`${plan.name}, ${free ? "free" : `${formatPrice(plan.price, currency)} one-time`}`}
                  className={`relative flex h-full flex-col overflow-hidden rounded-panel p-8 transition-all duration-500 hover:-translate-y-2 ${
                    featured
                      ? "border border-blush-deep/50 bg-ink text-cream shadow-glass"
                      : "border border-white/70 bg-white/55 backdrop-blur-md hover:shadow-lift hover:bg-white/80"
                  }`}
                >
                  {id === "luxe" && (
                    <span className="absolute right-6 top-6"><Pill tone="pending">Premium</Pill></span>
                  )}

                  <h3 className={`font-display text-title-lg ${featured ? "text-cream" : "text-ink"}`}>{plan.name}</h3>
                  <p className={`mt-1.5 text-small font-semibold leading-relaxed ${featured ? "text-cream/75" : "text-ink-2"}`}>{plan.tagline}</p>

                  <div className="mt-7 flex items-baseline gap-2">
                    <span className={`font-display text-display leading-none ${featured ? "text-cream" : "text-ink"}`}>
                      {formatPrice(plan.price, currency)}
                    </span>
                    <span className={`text-small font-bold ${featured ? "text-blush" : "text-ink-mute"}`}>{free ? "Free forever" : "one-time"}</span>
                  </div>
                  {!free && (
                    <p className={`mt-1.5 text-caption font-semibold ${featured ? "text-cream/55" : "text-ink-mute"}`}>No subscription · no recurring fees</p>
                  )}

                  <p className={`mt-6 text-small leading-relaxed ${featured ? "text-cream/70" : "text-ink-2"}`}>{plan.value}</p>

                  <div className={`hairline my-6 ${featured ? "opacity-60" : ""}`} />

                  <ul className="flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-start gap-2.5 text-body ${featured ? "text-cream/85" : "text-ink-2"}`}>
                        <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${featured ? "bg-blush-deep text-cream" : "bg-blush-soft text-blush-deep"}`}>
                          <Check size={10} strokeWidth={3.4} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => choose(id)}
                    className={`mt-8 w-full cursor-pointer rounded-full py-3.5 text-body font-bold transition-all duration-300 active:scale-[0.97] ${
                      featured
                        ? "bg-blush-deep text-cream hover:brightness-110 hover:shadow-lift"
                        : "border border-ink/20 text-ink hover:border-ink/50 hover:bg-ink hover:text-cream"
                    }`}
                  >
                    {free ? "Start planning free" : `Choose ${plan.name}`}
                  </button>
                </article>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.2}>
          <p className="mt-10 flex flex-wrap items-center justify-center gap-2 text-center text-caption font-semibold text-ink-mute">
            <Lock size={13} className="text-blush-deep" />
            Secure checkout via Stripe · one-time payment · no recurring fees
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
      <span className="pointer-events-none absolute -left-3 -top-9 font-display text-ornament leading-none text-blush/35 select-none" aria-hidden="true">“</span>
      <Stars className="relative" />
      <blockquote className={`relative mt-4 font-display leading-snug text-ink ${big ? "text-heading sm:text-display-xs" : "text-title sm:text-title-lg"}`}>
        {t.quote}
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <span className="h-px w-8 bg-blush-deep/70" aria-hidden="true" />
        <span className="text-small font-extrabold text-ink">{t.names}</span>
        <span className="text-small font-semibold text-ink-mute">· {t.city}</span>
      </figcaption>
    </figure>
  );
}

export function Stories() {
  const isMd = useMediaQuery("(min-width: 768px)");
  const [idx, setIdx] = useState(0);
  // Nothing real to show — render nothing rather than an empty shell or, as
  // before, invented quotes. Populate TESTIMONIALS and the section returns.
  const hasStories = TESTIMONIALS.length > 0;
  const next = () => setIdx((i) => (i + 1) % TESTIMONIALS.length);
  const prev = () => setIdx((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);

  if (!hasStories) return null;

  return (
    <section id="stories" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32">
      <Reveal>
        <p className="flex items-center gap-3 text-eyebrow font-extrabold uppercase tracking-label-x text-blush-deep">
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
          <div className="relative overflow-hidden rounded-panel border border-white/70 bg-white/50 p-8 backdrop-blur-md">
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
