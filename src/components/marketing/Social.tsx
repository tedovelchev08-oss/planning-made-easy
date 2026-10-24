import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { TESTIMONIALS } from "../../lib/data";
import { PLANS, PLAN_ORDER, formatPrice, type Plan } from "../../lib/plans";
import { useCurrency } from "../../lib/currency";
import { useNavigate } from "react-router-dom";
import { useApp, useMediaQuery } from "../../lib/store";
import { CurrencySelect, Reveal, Stars } from "../ui";

/* ------------------------------ pricing ------------------------------ */

/**
 * Free to start, two one-time upgrades. Plans, prices and feature lists all
 * come from lib/plans.ts; the currency is the visitor's to choose, and the
 * number is the same in each (€49 / $49 / £49) — never a conversion.
 */
export function Pricing() {
  const { openCheckout, openAuth, user, mode } = useApp();
  const navigate = useNavigate();
  const [currency, setCurrency] = useCurrency();

  const choose = (plan: Plan) => {
    if (plan === "essential") {
      // the free plan is not bought: it starts the planner
      if (mode === "demo") navigate("/demo");
      else if (user) navigate("/planner");
      else openAuth("begin");
      return;
    }
    // a purchase attaches to a wedding, so it needs an account first
    if (mode === "cloud" && !user) { openAuth("begin"); return; }
    openCheckout(plan);
  };

  return (
    <section id="pricing" className="scroll-mt-10 border-t border-[#3a342b] px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="font-display text-[clamp(36px,8vw,64px)] leading-[1.02] text-ivory">
          Start free. <em className="text-champagne">Upgrade once, if you love it.</em>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-ivory/70">
          Plan the whole wedding on {PLANS.essential.name} for free. When you want every guest and every invitation
          design, upgrade with one payment. No subscription, nothing to cancel.
        </p>
        <CurrencySelect value={currency} onChange={setCurrency} tone="dark" className="mt-6" />

        {/* a menu card: three plans under one rule, set like a list of wines */}
        <div className="relative mt-14 border border-champagne/40 p-2 text-left">
          <div className="grid border border-champagne/20 lg:grid-cols-3">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              const featured = !!plan.featured;
              const free = plan.price === 0;
              return (
                <article
                  key={id}
                  aria-label={`${plan.name}, ${free ? "free" : `${formatPrice(plan.price, currency)} one-time`}`}
                  className="flex flex-col border-b border-champagne/20 p-7 last:border-b-0 sm:p-9 lg:border-b-0 lg:border-r lg:last:border-r-0"
                >
                  <h3 className="font-display text-[30px] leading-none tracking-[0.04em] text-ivory">{plan.name}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ivory/65">{plan.tagline}</p>

                  <p className="mt-8 flex items-baseline gap-3">
                    <span className="font-display text-[56px] leading-none text-champagne">{formatPrice(plan.price, currency)}</span>
                    <span className="text-[12px] uppercase tracking-[0.2em] text-taupe">{free ? "free forever" : "one payment"}</span>
                  </p>

                  <p className="mt-6 text-[15px] leading-relaxed text-ivory/70">{plan.value}</p>

                  <ul className="mt-6 flex-1 space-y-2.5 border-t border-champagne/15 pt-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-[15px] text-ivory/85">
                        <Check size={14} strokeWidth={1.6} className="mt-1 shrink-0 text-champagne" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => choose(id)}
                    className={`mt-9 w-full cursor-pointer rounded-[2px] py-4 text-[12px] font-medium uppercase tracking-[0.2em] transition-colors duration-300 ${
                      featured
                        ? "bg-champagne text-onyx hover:bg-[#d8b97c]"
                        : "text-ivory shadow-[inset_0_0_0_1px_rgb(237_227_207/0.35)] hover:shadow-[inset_0_0_0_1px_rgb(237_227_207/1)]"
                    }`}
                  >
                    {free ? "Start planning free" : `Choose ${plan.name}`}
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        <p className="mt-8 flex flex-wrap items-center justify-center gap-2 text-[13px] text-taupe">
          <Lock size={13} className="text-champagne" aria-hidden="true" />
          Secure checkout via Stripe · one-time payment · no recurring fees
        </p>
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
