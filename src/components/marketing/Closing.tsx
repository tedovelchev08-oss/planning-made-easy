import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Send } from "lucide-react";
import { Logo } from "../ui";
import { useApp } from "../../lib/store";
import { SUPPORT_EMAIL } from "../../lib/links";

/* ------------------------------ final CTA ------------------------------ */

export function FinalCta() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { startSignup } = useApp();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || email.length < 5) {
      setError("Try something like you@example.com");
      return;
    }
    setError(null);
    // This box used to say "you're on the list — a welcome is on its way",
    // but the address went nowhere. Now it starts a real account with it.
    startSignup(email.trim());
  };

  return (
    <section className="bg-cream px-5 py-24 text-center text-[#1c1a17] sm:px-8 sm:py-32">
      <h2 className="mx-auto max-w-3xl font-display text-[clamp(38px,8vw,72px)] leading-[1.02]">
        Start with the date. <em className="block text-gold-deep">The rest follows.</em>
      </h2>
      <div className="mx-auto mt-10 max-w-lg" aria-live="polite">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <label htmlFor="cta-email" className="sr-only">Email address</label>
          <input
            id="cta-email" type="email" value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
            aria-invalid={!!error}
            aria-describedby={error ? "cta-email-error" : undefined}
            placeholder="you@example.com"
            className={`w-full flex-1 rounded-[2px] border bg-white px-5 py-4 text-[16px] text-[#1c1a17] placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-gold/40 ${
              error ? "border-gold-deep" : "border-[#d8cebb] focus:border-gold-deep"
            }`}
          />
          <button type="submit" className="group inline-flex items-center justify-center gap-2 rounded-[2px] bg-onyx px-7 py-4 text-[12px] font-medium uppercase tracking-[0.2em] text-ivory transition-colors duration-300 hover:bg-[#2a2621] cursor-pointer">
            Create your plan
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </button>
        </form>
        {error && (
          <p id="cta-email-error" role="alert" className="mt-3 text-[14px] text-gold-deep">
            {error}
          </p>
        )}
        <p className="mt-4 text-[14px] text-taupe">Free to begin. Upgrade only if you want to.</p>
      </div>
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
    { label: "Invitations", onClick: () => go("invitations") },
    { label: "Pricing", onClick: () => go("pricing") },
    { label: "Support", onClick: () => toast("We're here", `${SUPPORT_EMAIL}. Replies within a day, usually faster.`, "info") },
    { label: "Privacy", onClick: () => navigate("/privacy") },
    { label: "Terms", onClick: () => navigate("/terms") },
    { label: "Refunds", onClick: () => navigate("/refunds") },
    { label: "Cookies", onClick: () => navigate("/cookies") },
  ];

  return (
    <footer className="border-t border-[#3a342b] bg-onyx text-ivory">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-6 py-14 sm:px-8 md:flex-row md:justify-between">
        <div className="flex flex-col items-center gap-3 md:items-start">
          <Logo dark />
          <p className="flex items-center gap-1.5 font-display text-small italic text-cream/50">
            Two of you. One plan.
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3" aria-label="Footer">
          {links.map((l) => (
            <button key={l.label} onClick={l.onClick} className="text-small text-ivory/60 transition hover:text-ivory cursor-pointer">
              {l.label}
            </button>
          ))}
          <span className="hidden text-cream/20 md:inline">·</span>
          <button onClick={() => navigate("/planner")} className="inline-flex items-center gap-1.5 rounded-[2px] border border-champagne/50 px-4 py-2.5 text-[11px] uppercase tracking-[0.2em] text-champagne transition hover:bg-champagne hover:text-onyx cursor-pointer">
            <Send size={12} /> Open planner
          </button>
        </nav>
      </div>
      <div className="border-t border-cream/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-5 text-caption font-semibold text-cream/35 sm:px-8 md:flex-row">
          <span>© 2026 Twofold All rights reserved.</span>
          <span className="font-display italic text-cream/45">Made slowly, for two at a time.</span>
        </div>
      </div>
    </footer>
  );
}
