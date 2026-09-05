import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Heart, Send } from "lucide-react";
import { Reveal, Logo } from "../ui";
import { useApp } from "../../lib/store";

/* ------------------------------ final CTA ------------------------------ */

export function FinalCta() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useApp();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || email.length < 5) {
      setError("Try something like you@example.com");
      return;
    }
    setError(null);
    setSent(true);
    toast("You're on the list", "A warm welcome is on its way to your inbox.");
  };

  return (
    <section className="px-5 pb-28 pt-4 sm:px-8">
      <Reveal>
        <div
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[3rem] rounded-tl-[6rem] rounded-br-[6rem] px-7 py-16 text-center sm:px-14 sm:py-24"
          style={{
            background:
              "radial-gradient(60% 80% at 15% 20%, rgb(255 181 194 / 0.5), transparent 60%), radial-gradient(50% 70% at 85% 15%, rgb(249 239 223 / 0.9), transparent 60%), radial-gradient(55% 75% at 60% 95%, rgb(233 139 160 / 0.22), transparent 60%), linear-gradient(160deg, #FFF8F0, #FDF1E6)",
          }}
        >
          {/* floating translucent shapes */}
          <div className="pointer-events-none absolute left-[8%] top-[14%] h-28 w-28 rounded-full border border-white/80 bg-white/30 backdrop-blur-sm anim-bob" aria-hidden="true" />
          <div className="pointer-events-none absolute right-[10%] top-[22%] h-16 w-16 rounded-[1.4rem] border border-white/80 bg-white/35 backdrop-blur-sm rotate-12 anim-bob-sm" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-[16%] left-[16%] h-20 w-20 rounded-[1.8rem] border border-white/70 bg-white/25 backdrop-blur-sm -rotate-12 anim-bob" style={{ animationDelay: "-3s" }} aria-hidden="true" />
          <svg className="pointer-events-none absolute right-[20%] bottom-[14%] h-20 w-20 text-blush-deep/40 anim-spin-slow" viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <circle cx="50" cy="50" r="32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 9" />
          </svg>
          {[12, 30, 55, 72, 88].map((left, i) => (
            <span key={left} className="inv-petal" style={{ left: `${left}%`, animationDuration: `${9 + i * 2.2}s`, animationDelay: `${i * 1.7}s` }} aria-hidden="true" />
          ))}

          <p className="relative text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-blush-deep">Begin gently</p>
          <h2 className="relative mx-auto mt-5 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight text-ink sm:text-[3.4rem]">
            Start with the date.<br /><em className="text-blush-deep">We'll help with the rest.</em>
          </h2>

          <div className="relative mx-auto mt-10 max-w-lg" aria-live="polite">
            <AnimatePresence mode="wait">
              {!sent ? (
                <motion.form
                  key="form" onSubmit={submit}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:rounded-full sm:border sm:border-white/80 sm:bg-white/55 sm:p-2 sm:shadow-card sm:backdrop-blur-md"
            >
                  <label htmlFor="cta-email" className="sr-only">Email address</label>
                  <input
                    id="cta-email" type="email" value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                    aria-invalid={!!error}
                    aria-describedby={error ? "cta-email-error" : undefined}
                    placeholder="you@example.com"
                    className={`w-full flex-1 rounded-full border bg-white/70 px-6 py-3.5 text-[0.95rem] text-ink placeholder:text-ink-mute/70 focus:outline-none focus:ring-2 sm:border-0 sm:bg-transparent sm:py-2.5 sm:focus:ring-0 ${
                      error ? "border-blush-deep/70 focus:ring-blush/40" : "border-white/80 focus:border-blush-deep/60 focus:ring-blush/30"
                    }`}
                  />
                  <button type="submit" className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-8 py-3.5 text-[0.92rem] font-bold text-cream transition-all duration-300 hover:bg-ink/85 active:scale-[0.97] cursor-pointer">
                    Get started
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className="flex items-center justify-center gap-3 rounded-full border border-white/80 bg-white/70 px-7 py-4 shadow-card backdrop-blur-md"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush-deep text-cream"><Check size={15} strokeWidth={3} /></span>
                  <p className="text-[0.95rem] font-bold text-ink">You're on the list — see you at <em className="font-display italic">organized.</em></p>
                </motion.div>
              )}
            </AnimatePresence>
            {error && !sent && (
              <p id="cta-email-error" role="alert" className="mt-3 text-[0.78rem] font-bold text-blush-deep">
                {error}
              </p>
            )}
            <p className="mt-4 text-[0.74rem] font-semibold text-ink-mute">Free to begin · upgrade only when you're ready</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------ footer ------------------------------ */

export function Footer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useApp();

  const go = (id: string) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 380);
    } else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const links: { label: string; onClick: () => void }[] = [
    { label: "Features", onClick: () => go("features") },
    { label: "Pricing", onClick: () => go("pricing") },
    { label: "Support", onClick: () => toast("We're here", "support@luma.love — replies within a day, usually faster.", "info") },
    { label: "Privacy", onClick: () => toast("Privacy, plainly", "Your data is yours. Export or erase anytime.", "info") },
    { label: "Terms", onClick: () => toast("Terms, kindly", "Fair terms, written for humans. Available in-app.", "info") },
  ];

  return (
    <footer className="bg-ink text-cream">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-6 py-14 sm:px-8 md:flex-row md:justify-between">
        <div className="flex flex-col items-center gap-3 md:items-start">
          <Logo dark />
          <p className="flex items-center gap-1.5 font-display text-[0.85rem] italic text-cream/50">
            Plan the feeling <Heart size={11} className="text-blush" fill="#FFB5C2" /> not just the wedding
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3" aria-label="Footer">
          {links.map((l) => (
            <button key={l.label} onClick={l.onClick} className="text-[0.82rem] font-semibold text-cream/60 transition hover:text-blush cursor-pointer">
              {l.label}
            </button>
          ))}
          <span className="hidden text-cream/20 md:inline">·</span>
          <button onClick={() => navigate("/planner")} className="inline-flex items-center gap-1.5 rounded-full border border-blush/40 px-4 py-2 text-[0.8rem] font-bold text-blush transition hover:bg-blush hover:text-ink cursor-pointer">
            <Send size={12} /> Open planner
          </button>
        </nav>
      </div>
      <div className="border-t border-cream/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-5 text-[0.7rem] font-semibold text-cream/35 sm:px-8 md:flex-row">
          <span>© 2026 Luma Studio, Inc. All rights reserved.</span>
          <span className="font-display italic text-cream/45">Made slowly, for two at a time.</span>
        </div>
      </div>
    </footer>
  );
}
