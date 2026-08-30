import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Check, Heart, Loader2, Lock, Sparkles, X } from "lucide-react";
import { TIERS, Plan, fmtMoney } from "../lib/data";
import { useApp, usePrefersReducedMotion, useStats } from "../lib/store";

/* ------------------------------ logo ------------------------------ */

export function Logo({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 20.6S4.9 16 2.7 11.9C1.3 9.2 3 5.9 6.2 5.9c2 0 3.3 1.1 4 2.2h3.6c.7-1.1 2-2.2 4-2.2 3.2 0 4.9 3.3 3.5 6-2.2 4.1-9.3 8.7-9.3 8.7z"
          fill="none" stroke="#D4AF37" strokeWidth="1.7" strokeLinejoin="round"
        />
        <path d="M12 20.6S4.9 16 2.7 11.9C1.3 9.2 3 5.9 6.2 5.9c2 0 3.3 1.1 4 2.2h3.6c.7-1.1 2-2.2 4-2.2 3.2 0 4.9 3.3 3.5 6-2.2 4.1-9.3 8.7-9.3 8.7z"
          fill="#D4AF37" fillOpacity="0.16" stroke="none" />
      </svg>
      <span className={`font-display text-[1.45rem] leading-none tracking-tight ${dark ? "text-cream" : "text-ink"}`}>
        luma
      </span>
    </span>
  );
}

/* ------------------------------ buttons ------------------------------ */

const btnBase =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

export const btn = {
  ink: `${btnBase} rounded-full bg-ink text-cream hover:bg-ink/85 hover:shadow-lift px-6 py-3`,
  gold: `${btnBase} rounded-full bg-gold text-ink hover:brightness-105 hover:shadow-lift px-6 py-3`,
  blush: `${btnBase} rounded-full bg-blush-deep text-white hover:brightness-105 px-6 py-3`,
  outline: `${btnBase} rounded-full border border-ink/20 text-ink hover:border-ink/50 hover:bg-white/60 px-6 py-3`,
  outlineLight: `${btnBase} rounded-full border border-cream/40 text-cream hover:bg-cream/10 px-6 py-3`,
  ghost: `${btnBase} rounded-full px-4 py-2 text-ink-2 hover:text-ink hover:bg-ink/5`,
  sm: `${btnBase} rounded-full px-4 py-2 text-sm`,
};

/* ------------------------------ inputs ------------------------------ */

export const inputCls =
  "w-full rounded-xl border border-ink/15 bg-white/80 px-4 py-2.5 text-[0.95rem] text-ink placeholder:text-ink-mute/70 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25 transition";

export const selectCls =
  "rounded-xl border border-ink/15 bg-white/80 px-3 py-2 text-sm text-ink focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25 transition cursor-pointer";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ink-mute">{label}</span>
      {children}
    </label>
  );
}

/* ------------------------------ pills ------------------------------ */

const tones: Record<string, string> = {
  confirmed: "bg-sage-soft text-sage-deep border-sage/50",
  pending: "bg-blush-soft text-blush-deep border-blush/60",
  declined: "bg-ink/5 text-ink-mute border-ink/10",
  Inquiry: "bg-lav-soft text-lav-deep border-lav/60",
  Proposal: "bg-blush-soft text-blush-deep border-blush/60",
  Booked: "bg-sage-soft text-sage-deep border-sage/50",
  Declined: "bg-ink/5 text-ink-mute border-ink/10",
  gold: "bg-gold-soft text-gold-deep border-gold/40",
};

export function Pill({ tone, children, className = "" }: { tone: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.72rem] font-bold tracking-wide whitespace-nowrap ${tones[tone] ?? "bg-ink/5 text-ink-2 border-ink/10"} ${className}`}>
      {children}
    </span>
  );
}

/* ------------------------------ modal / drawer ------------------------------ */

export function Modal({
  open, onClose, children, wide = false, label,
}: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean; label: string }) {
  const dlgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  // move focus into the dialog on open, restore it to the trigger on close
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => dlgRef.current?.focus(), 40);
    return () => { window.clearTimeout(t); trigger?.focus?.(); };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <button aria-label="Close dialog" className="absolute inset-0 bg-ink/45 backdrop-blur-[3px] cursor-default" onClick={onClose} />
          <motion.div
            ref={dlgRef} tabIndex={-1}
            role="dialog" aria-modal="true" aria-label={label}
            initial={{ y: 46, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={`relative w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92vh] overflow-y-auto rounded-t-[1.8rem] sm:rounded-[1.8rem] bg-cream shadow-glass border border-white/70`}
          >
            <button
              onClick={onClose} aria-label="Close"
              className="absolute right-4 top-4 z-10 rounded-full bg-ink/5 p-2 text-ink-2 transition hover:bg-ink/10 hover:text-ink cursor-pointer"
            >
              <X size={16} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[75]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close menu" className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] cursor-default" onClick={onClose} />
          <motion.aside
            role="dialog" aria-modal="true" aria-label={label}
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="absolute left-0 top-0 h-full w-[84vw] max-w-[320px] bg-cream shadow-glass border-r border-white/60 overflow-y-auto"
          >
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ------------------------------ reveal ------------------------------ */

export function Reveal({ children, delay = 0, y = 30, className = "" }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------ empty state ------------------------------ */

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-ink/15 bg-white/50 px-8 py-16 text-center">
      <svg width="54" height="54" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="mb-5 anim-bob-sm">
        <rect x="6" y="14" width="36" height="24" rx="4" stroke="#D4AF37" strokeWidth="2" />
        <path d="M6 17l18 12 18-12" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 7.5s-3-2-4.9-0.6c-1.6 1.2-1 3.6 0.5 4.8L24 15l4.4-3.3c1.5-1.2 2.1-3.6 0.5-4.8C27 5.5 24 7.5 24 7.5z" fill="#FFB5C2" />
      </svg>
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-[0.95rem] leading-relaxed text-ink-2">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ------------------------------ toasts ------------------------------ */

export function ToastHost() {
  const { toasts, dismissToast } = useApp();
  return createPortal(
    <div className="pointer-events-none fixed bottom-5 right-5 z-[95] flex w-[min(92vw,360px)] flex-col gap-2.5" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/60 bg-ink/95 px-4 py-3.5 text-cream shadow-glass backdrop-blur"
          >
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${t.tone === "success" ? "bg-sage text-ink" : t.tone === "warn" ? "bg-blush text-ink" : "bg-lav text-ink"}`}>
              <Check size={12} strokeWidth={3} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{t.title}</p>
              {t.desc && <p className="mt-0.5 text-xs text-cream/70">{t.desc}</p>}
            </div>
            <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="text-cream/50 transition hover:text-cream cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/* ------------------------------ checkout (simulated Stripe) ------------------------------ */

export function CheckoutModal() {
  const { checkout, closeCheckout, patch, toast, db } = useApp();
  const [step, setStep] = useState<"review" | "processing" | "done">("review");
  const tier = TIERS.find((t) => t.id === checkout);
  const completedFor = useRef<Plan | null>(null);

  useEffect(() => {
    if (checkout) {
      setStep("review");
      completedFor.current = null;
    }
  }, [checkout]);

  const rankOf = (p: Plan) => TIERS.findIndex((t) => t.id === p);
  const startPayment = () => {
    if (!tier) return;
    // entitlements only ever move upward — never downgrade or re-sell the same plan
    if (rankOf(tier.id) <= rankOf(db.plan)) {
      const owned = TIERS[rankOf(db.plan)];
      toast(
        db.plan === tier.id ? "You already own this plan" : "You already have more",
        `${owned.name} covers everything here — no need to buy twice.`,
        "info",
      );
      closeCheckout();
      return;
    }
    setStep("processing");
  };

  useEffect(() => {
    if (step !== "processing") return;
    const t = setTimeout(() => setStep("done"), 1500);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step !== "done" || !tier) return;
    // Fire exactly once per purchase — guard against re-runs from identity churn.
    if (completedFor.current === tier.id) return;
    completedFor.current = tier.id;
    patch({ plan: tier.id });
    toast(`Welcome to ${tier.name}`, "Your entitlement is active across the whole workspace.");
    const t = setTimeout(closeCheckout, 1600);
    return () => clearTimeout(t);
  }, [step, tier, patch, toast, closeCheckout]);

  return (
    <Modal open={!!checkout} onClose={closeCheckout} label="Checkout">
      {tier && (
        <div className="p-7 sm:p-9">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-gold-deep">Secure checkout · Stripe</p>
          <h2 className="mt-2 font-display text-3xl text-ink">{tier.name}</h2>
          <p className="mt-1 text-sm text-ink-2">{tier.blurb}</p>

          <div className="mt-6 rounded-2xl border border-ink/10 bg-white/70 p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-ink-2">One-time purchase</span>
              <span className="font-display text-3xl text-ink">{fmtMoney(tier.price)}</span>
            </div>
            <p className="mt-1 text-xs text-ink-mute">No monthly subscription. One beautiful purchase — yours forever.</p>
            {db.plan !== "essential" && step === "review" && (
              <div className="mt-4 border-t border-dashed border-ink/10 pt-3 text-xs text-ink-2">
                Current plan: <span className="font-bold capitalize text-ink">{db.plan}</span> — you'll be upgraded instantly.
              </div>
            )}
          </div>

          {step === "review" && (
            <div className="mt-6 space-y-3">
              <button className={`${btn.ink} w-full`} onClick={startPayment}>
                <Lock size={14} /> Pay {fmtMoney(tier.price)} securely
              </button>
              <p className="text-center text-[0.7rem] text-ink-mute">Demo checkout — no real charge. Webhook → entitlement → workspace unlock.</p>
            </div>
          )}
          {step === "processing" && (
            <div className="mt-8 flex flex-col items-center gap-3 py-4 text-ink-2">
              <Loader2 size={26} className="animate-spin text-gold-deep" />
              <p className="text-sm font-semibold">Confirming with Stripe…</p>
            </div>
          )}
          {step === "done" && (
            <div className="mt-8 flex flex-col items-center gap-3 py-4">
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-soft text-sage-deep"
              >
                <Check size={26} strokeWidth={3} />
              </motion.span>
              <p className="font-display text-xl text-ink">Payment complete</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------ auth modal ------------------------------ */

/** word that keeps turning in the auth headline */
function RotatingWord() {
  const reduced = usePrefersReducedMotion();
  const words = ["feeling.", "calm.", "story.", "yes."];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % words.length), 2400);
    return () => window.clearInterval(id);
  }, [reduced]);
  return (
    <span className="relative inline-flex overflow-hidden align-baseline">
      <AnimatePresence mode="wait">
        <motion.span
          key={words[i]}
          initial={{ y: "110%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-110%", opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="italic text-blush"
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** input whose little heart lights up while you type */
function LovelyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focus, setFocus] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        className={`${inputCls} pr-10`}
      />
      <motion.span
        animate={focus ? { scale: [1, 1.4, 1] } : {}}
        transition={{ duration: 0.5 }}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
        aria-hidden="true"
      >
        <Heart size={15} className={focus ? "text-gold" : "text-ink-mute/35"} fill={focus ? "#D4AF37" : "none"} />
      </motion.span>
    </div>
  );
}

function strengthOf(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
const STRENGTH = [
  { label: "Too short", bar: "bg-ink/15" },
  { label: "Gentle", bar: "bg-blush" },
  { label: "Getting there", bar: "bg-lav" },
  { label: "Strong", bar: "bg-sage" },
  { label: "Unbreakable", bar: "bg-gold" },
];

export function AuthModal() {
  const { authOpen, setAuthOpen, signIn, toast, db } = useApp();
  const stats = useStats();
  const reduced = usePrefersReducedMotion();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("maya@luma.love");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) { toast("Hmm, that email doesn't look right", undefined, "warn"); return; }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (mode === "reset") {
        toast("Reset link sent", `Check ${email} for instructions.`);
        setAuthOpen(false);
        return;
      }
      const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      signIn({ name, email });
      toast(mode === "signup" ? "Welcome to Luma" : "Welcome back", "Your session is saved on this device.");
      setAuthOpen(false);
    }, 900);
  };

  const strength = strengthOf(password);
  const stagger = (i: number) => ({
    initial: reduced ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <Modal open={authOpen} onClose={() => setAuthOpen(false)} label="Sign in" wide>
      <div className="grid sm:grid-cols-[1.02fr_1fr]">
        {/* living ink panel */}
        <aside className="relative hidden overflow-hidden bg-ink p-9 text-cream sm:flex sm:flex-col sm:justify-between">
          <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-blush/20 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-lav/20 blur-3xl" aria-hidden="true" />
          {[16, 44, 70, 88].map((left, i) => (
            <span key={left} className="inv-petal" style={{ left: `${left}%`, animationDuration: `${10 + i * 2.4}s`, animationDelay: `${i * 1.9}s` }} aria-hidden="true" />
          ))}

          <div className="relative flex items-center justify-between">
            <Logo dark />
            <span className="rounded-full border border-gold/40 px-3 py-1.5 text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-gold">Planner access</span>
          </div>

          <div className="relative py-10">
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-cream/40">The Luma planner</p>
            <h2 className="mt-4 font-display text-[2.7rem] leading-[1.05] tracking-tight">
              Plan the<br /><RotatingWord />
            </h2>
            <p className="mt-5 max-w-xs text-[0.9rem] leading-relaxed text-cream/60">
              One calm workspace for guests, budget, timeline, seating and the big day itself — from the first guest to the final dance.
            </p>
          </div>

          <div className="relative space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-cream/12 bg-cream/6 px-4 py-3.5 backdrop-blur-sm">
              <Heart size={16} className="text-blush" fill="#FFB5C2" />
              <div>
                <p className="font-display text-lg leading-none">{stats.days} days</p>
                <p className="mt-1 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-cream/45">until {db.wedding.names} say “I do”</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[0.72rem] font-semibold text-cream/45">
              <Stars /> Loved by 4,200+ couples
            </div>
          </div>
        </aside>

        {/* form */}
        <div className="p-7 sm:p-9">
          <div className="sm:hidden"><Logo /></div>

          <motion.h2 {...stagger(0)} key={mode} className="mt-4 font-display text-[1.9rem] leading-tight text-ink sm:mt-0 sm:text-[2.1rem]">
            {mode === "login" && <>Welcome <em className="text-blush-deep">back.</em></>}
            {mode === "signup" && <>Begin the <em className="text-blush-deep">feeling.</em></>}
            {mode === "reset" && <>Take a <em className="text-lav-deep">breath.</em></>}
          </motion.h2>
          <motion.p {...stagger(1)} className="mt-1.5 text-[0.86rem] font-semibold text-ink-2">
            {mode === "login" && "Your plan is right where you left it."}
            {mode === "signup" && "Two minutes now, two hundred calmer hours later."}
            {mode === "reset" && "We'll send a link — passwords are the least romantic part anyway."}
          </motion.p>

          <motion.div {...stagger(2)} className="mt-5 flex gap-1 rounded-full bg-ink/5 p-1 text-sm font-semibold" role="tablist" aria-label="Authentication mode">
            {(["login", "signup"] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className={`relative flex-1 overflow-hidden rounded-full py-2 capitalize transition cursor-pointer ${mode === m ? "text-cream" : "text-ink-mute hover:text-ink"}`}>
                {mode === m && !reduced && (
                  <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 34 }} />
                )}
                {mode === m && reduced && <span className="absolute inset-0 rounded-full bg-ink" />}
                <span className="relative">{m === "login" ? "Sign in" : "Sign up"}</span>
              </button>
            ))}
          </motion.div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <motion.div {...stagger(3)}>
              <Field label="Email">
                <LovelyInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </Field>
            </motion.div>
            {mode !== "reset" && (
              <motion.div {...stagger(4)}>
                <Field label="Password">
                  <LovelyInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                </Field>
                {mode === "signup" && password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1.5">
                      {[0, 1, 2, 3].map((seg) => (
                        <span key={seg} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${seg < strength ? STRENGTH[strength].bar : "bg-ink/10"}`} />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[0.68rem] font-bold text-ink-mute">{STRENGTH[strength].label}</p>
                  </div>
                )}
              </motion.div>
            )}
            {mode === "login" && (
              <motion.button {...stagger(4)} type="button" onClick={() => setMode("reset")} className="text-xs font-semibold text-ink-mute underline-offset-2 hover:text-gold-deep hover:underline cursor-pointer">
                Forgot password?
              </motion.button>
            )}
            <motion.div {...stagger(5)}>
              <button type="submit" disabled={busy} className={`btn3d ${mode === "signup" ? "btn3d-gold" : "btn3d-ink"} w-full rounded-2xl py-4 text-[0.95rem] font-extrabold disabled:pointer-events-none disabled:opacity-60 cursor-pointer`}>
                {busy ? <Loader2 size={17} className="mx-auto animate-spin" /> : mode === "reset" ? "Send reset link" : mode === "signup" ? "Create our planner →" : "Step back in →"}
              </button>
            </motion.div>
          </form>

          <motion.div {...stagger(6)} className="my-5 flex items-center gap-3 text-[0.66rem] font-bold uppercase tracking-[0.18em] text-ink-mute">
            <span className="h-px flex-1 bg-ink/10" /> or <span className="h-px flex-1 bg-ink/10" />
          </motion.div>

          <motion.button
            {...stagger(7)}
            onClick={() => { signIn({ name: "Maya Chen", email: "maya@gmail.com" }); toast("Signed in with Google", "maya@gmail.com"); setAuthOpen(false); }}
            className="btn3d btn3d-light flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-[0.9rem] font-bold cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.9z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5l-3.9 3C3.2 21.3 7.3 24 12 24z" />
              <path fill="#FBBC05" d="M5.1 14.4c-.3-.8-.4-1.6-.4-2.4s.2-1.6.4-2.4l-4-3C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l3.9-3z" />
              <path fill="#EA4335" d="M12 4.7c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l4 3c1-2.9 3.6-4.9 6.8-4.9z" />
            </svg>
            Continue with Google
          </motion.button>

          <motion.p {...stagger(8)} className="mt-5 flex items-center justify-center gap-1.5 text-center text-[0.7rem] text-ink-mute">
            <Sparkles size={12} className="text-gold" /> Sessions persist on this device · Supabase-ready architecture
          </motion.p>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ feature icons (custom, animated) ------------------------------ */

export function FeatureIcon({ name, className = "" }: { name: string; className?: string }) {
  const common = { fill: "none", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "flow": // guest flow — two figures + orbiting dot
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <circle cx="18" cy="17" r="6" stroke="#EE8FA1" {...common} />
          <path d="M7 38c1.2-6.4 5.5-10 11-10s9.8 3.6 11 10" stroke="#EE8FA1" {...common} />
          <circle cx="33" cy="15" r="4.5" stroke="#D4AF37" {...common} />
          <path d="M26.5 34c1-4.6 3.6-7.4 7.5-7.4 3 0 5.4 1.6 6.8 4.4" stroke="#D4AF37" {...common} />
          <circle cx="40" cy="24" r="2.2" fill="#A8C5A0" className="anim-pulse-soft" />
        </svg>
      );
    case "budget": // ledger with a rising calm line
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <rect x="8" y="8" width="32" height="32" rx="7" stroke="#74996B" {...common} />
          <path d="M15 29l6-6 4 3.5L33 18" stroke="#D4AF37" {...common} />
          <circle cx="33" cy="18" r="2.4" fill="#EE8FA1" className="anim-pulse-soft" />
          <path d="M15 34h18" stroke="#A8C5A0" {...common} />
        </svg>
      );
    case "timeline": // arc of time with a marker
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <path d="M10 36a17 17 0 0 1 28-13" stroke="#A78BD4" {...common} />
          <path d="M10 36a17 17 0 0 0 4.5 4" stroke="#C9B8E8" {...common} />
          <circle cx="38" cy="23" r="3" fill="#D4AF37" className="anim-pulse-soft" />
          <path d="M24 36v-9" stroke="#332B31" {...common} />
          <circle cx="24" cy="36" r="2" fill="#332B31" />
        </svg>
      );
    case "vendors": // handshake simplified to interlocking rings + spark
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <circle cx="19" cy="26" r="9" stroke="#EE8FA1" {...common} />
          <circle cx="29" cy="22" r="9" stroke="#D4AF37" {...common} />
          <path d="M36 8l1.2 2.6L40 12l-2.8 1.4L36 16l-1.2-2.6L32 12l2.8-1.4z" fill="#C9B8E8" className="anim-pulse-soft" />
        </svg>
      );
    case "seating": // round table, seats around
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <circle cx="24" cy="24" r="8.5" stroke="#74996B" {...common} />
          {[0, 60, 120, 180, 240, 300].map((a) => {
            const r = (a * Math.PI) / 180;
            return <circle key={a} cx={24 + 15 * Math.cos(r)} cy={24 + 15 * Math.sin(r)} r="2.6" fill={a % 120 === 0 ? "#EE8FA1" : "#C9B8E8"} />;
          })}
        </svg>
      );
    case "world": // arch + orbit
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <path d="M10 38V22a14 14 0 0 1 28 0v16" stroke="#D4AF37" {...common} />
          <path d="M6 38h36" stroke="#332B31" {...common} />
          <circle cx="24" cy="20" r="4" stroke="#EE8FA1" {...common} />
          <circle cx="38" cy="14" r="2.2" fill="#A8C5A0" className="anim-pulse-soft" />
        </svg>
      );
    default:
      return null;
  }
}

/* ------------------------------ live design frame ------------------------------ */

/**
 * Renders a self-contained HTML invitation inside a sandboxed iframe.
 * In thumbnail mode it's downscaled and non-interactive (live gallery previews);
 * otherwise it's a fully explorable, working invitation.
 */
export function DesignFrame({
  html, title, className = "", interactive = true, thumbWidth = 144, thumbHeight = 180,
}: {
  html: string;
  title: string;
  className?: string;
  interactive?: boolean;
  thumbWidth?: number;
  thumbHeight?: number;
}) {
  if (interactive) {
    return (
      <iframe
        title={title}
        srcDoc={html}
        sandbox="allow-scripts allow-forms allow-popups"
        loading="lazy"
        className={`w-full border-0 ${className}`}
      />
    );
  }
  const scale = thumbWidth / 800;
  return (
    <div className="pointer-events-none relative overflow-hidden" style={{ width: "100%", height: thumbHeight }} aria-hidden="true">
      <iframe
        title={title}
        srcDoc={html}
        sandbox="allow-scripts"
        loading="lazy"
        tabIndex={-1}
        className="absolute left-0 top-0 origin-top-left border-0"
        style={{ width: 800, height: Math.round(thumbHeight / scale), transform: `scale(${scale})` }}
      />
    </div>
  );
}

/* ------------------------------ resilient image ------------------------------ */

/** <img> that degrades to a quiet branded placeholder if the asset fails to load. */
export function SafeImg({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        role="img" aria-label={alt}
        className={`flex items-center justify-center bg-gradient-to-br from-blush-soft via-cream to-lav-soft ${className}`}
      >
        <svg width="30" height="30" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 38S10 29 6.5 21.5C4.2 16.4 7.8 11 13.2 11c3.5 0 6.4 2.1 10.8 6.1 4.4-4 7.3-6.1 10.8-6.1 5.4 0 9 5.4 6.7 10.5C38 29 24 38 24 38z" stroke="#D4AF37" strokeWidth="1.6" />
          <path d="M14 25c3 4 7 7 10 8.6M34 25c-3 4-7 7-10 8.6" stroke="#EE8FA1" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}

/* ------------------------------ misc ------------------------------ */

export function Stars({ n = 5, className = "" }: { n?: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: n }).map((_, i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill="#D4AF37" aria-hidden="true">
          <path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
        </svg>
      ))}
    </span>
  );
}

export function GoldDivider({ className = "" }: { className?: string }) {
  return <div className={`gold-hairline ${className}`} aria-hidden="true" />;
}
