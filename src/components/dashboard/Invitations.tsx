import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Crown, Heart, Lock, Mail, Monitor, Music, Play, Smartphone, Sparkles, StopCircle, Tablet, X } from "lucide-react";
import { MEALS, TEMPLATE_CATS, Template, fmtDate, seedTemplates } from "../../lib/data";
import { IMAGES } from "../../lib/images";
import { useApp, usePrefersReducedMotion } from "../../lib/store";
import { Field, Modal, Pill, Reveal, SafeImg, btn, inputCls } from "../ui";

/* ------------------------------ palette & font presets ------------------------------ */

const PALETTES = [
  { name: "Champagne", bg: "#FFF8F0", ink: "#332B31", accent: "#D4AF37" },
  { name: "Blush", bg: "#FFE7EC", ink: "#5C4F55", accent: "#E98BA0" },
  { name: "Sage", bg: "#E7F0E3", ink: "#3E4A38", accent: "#74996B" },
  { name: "Lavender", bg: "#EEE8F9", ink: "#4A4152", accent: "#A78BD4" },
  { name: "Noir", bg: "#332B31", ink: "#FFF8F0", accent: "#FFB5C2" },
  { name: "Ivory", bg: "#FFFFFF", ink: "#1E1A1D", accent: "#D4AF37" },
];

const PHOTO_CHOICES = [
  { label: "Garden suite", src: IMAGES.invGarden },
  { label: "Blush modern", src: IMAGES.invModern },
  { label: "Editorial noir", src: IMAGES.invEditorial },
  { label: "Us, golden hour", src: IMAGES.couple },
  { label: "The rings", src: IMAGES.hands },
];

/* ------------------------------ gentle web-audio music ------------------------------ */

function useChimeLoop() {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setPlaying(false);
  };

  const start = () => {
    if (playing) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    ctxRef.current = ctx;
    const notes = [523.25, 659.25, 783.99, 659.25, 523.25, 392.0, 440.0, 523.25];
    let step = 0;
    const pluck = () => {
      if (ctx.state === "closed") return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = notes[step % notes.length];
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.7);
      step++;
    };
    pluck();
    timerRef.current = window.setInterval(pluck, 900);
    setPlaying(true);
  };

  useEffect(() => () => stop(), []);
  return { playing, start, stop };
}

/* ------------------------------ invite artwork ------------------------------ */

function resolveColors(t: Template, cfgColors: { bg: string; ink: string; accent: string } | null) {
  return cfgColors ?? { bg: t.bg, ink: t.ink, accent: t.accent };
}

function Flourish({ accent, className, rotate = 0 }: { accent: string; className?: string; rotate?: number }) {
  return (
    <svg viewBox="0 0 60 60" className={className} style={{ transform: `rotate(${rotate}deg)` }} aria-hidden="true">
      <path d="M4 56 C 10 30, 30 10, 56 4" fill="none" stroke={accent} strokeWidth="1.4" />
      <path d="M14 52 C 20 34, 34 20, 52 14" fill="none" stroke={accent} strokeWidth="0.8" opacity="0.6" />
      <circle cx="56" cy="4" r="2" fill={accent} />
    </svg>
  );
}

function InviteArt({
  template, colors, serif, cfg, animated, dateIso, rsvpSlot, compact = false,
}: {
  template: Template;
  colors: { bg: string; ink: string; accent: string };
  serif: boolean;
  cfg: { names: string; line1: string; line2: string; venueLine: string; rsvp: boolean; meal: boolean; notes: boolean; photo: string | null };
  animated: boolean;
  dateIso: string;
  rsvpSlot?: React.ReactNode;
  compact?: boolean;
}) {
  const fontFamily = serif ? "'Playfair Display', Georgia, serif" : "'Nunito Sans', sans-serif";
  const wrap = (children: React.ReactNode, delay = 0) =>
    animated ? (
      <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </motion.div>
    ) : (
      children
    );

  return (
    <div className="relative w-full overflow-hidden" style={{ background: colors.bg, color: colors.ink, fontFamily }}>
      {animated && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {[10, 25, 42, 60, 78, 90].map((left, i) => (
            <span key={left} className="inv-petal" style={{ left: `${left}%`, animationDuration: `${8 + i * 1.8}s`, animationDelay: `${i * 1.3}s` }} />
          ))}
        </div>
      )}

      <Flourish accent={colors.accent} className="absolute left-4 top-4 h-12 w-12 opacity-70" />
      <Flourish accent={colors.accent} className="absolute bottom-4 right-4 h-12 w-12 opacity-70" rotate={180} />

      <div className={`relative flex flex-col items-center px-8 text-center ${compact ? "py-10" : "py-14"}`}>
        {template.photo && cfg.photo ? (
          wrap(
            <div className="mb-7 h-44 w-full max-w-[300px] overflow-hidden rounded-t-[999px] shadow-lg sm:h-56">
              <SafeImg src={cfg.photo} alt="Invitation photograph" className="h-full w-full object-cover" />
            </div>,
            0.05,
          )
        ) : (
          wrap(
            <motion.span animate={animated ? { scale: [1, 1.12, 1] } : {}} transition={{ duration: 3.2, repeat: animated ? Infinity : 0 }} aria-hidden="true">
              <Heart size={compact ? 22 : 28} style={{ color: colors.accent }} fill={colors.accent} fillOpacity={0.25} />
            </motion.span>,
            0.05,
          )
        )}

        {wrap(<p className="text-[0.6rem] font-extrabold uppercase tracking-[0.4em]" style={{ color: colors.accent }}>The wedding of</p>, 0.15)}
        {wrap(
          <h3 className={`mt-3 leading-[1.06] ${compact ? "text-3xl" : "text-4xl sm:text-[2.9rem]"}`} style={{ fontWeight: serif ? 600 : 800 }}>
            {cfg.names.split("&")[0]?.trim()}
            <span className="mx-2 inline-block align-middle font-display italic" style={{ color: colors.accent }}>&</span>
            {cfg.names.split("&")[1]?.trim() ?? ""}
          </h3>,
          0.25,
        )}
        {wrap(<p className="mt-4 text-[0.82rem] tracking-wide opacity-80">{cfg.line1}</p>, 0.35)}
        {wrap(<p className="text-[0.82rem] tracking-wide opacity-80">{cfg.line2}</p>, 0.4)}

        {wrap(
          <div className="my-6 flex w-full max-w-[320px] items-center gap-4" aria-hidden="true">
            <span className="h-px flex-1" style={{ background: colors.accent, opacity: 0.5 }} />
            <span className="text-[0.68rem] font-extrabold tracking-[0.3em]" style={{ color: colors.accent }}>SAVE THE DATE</span>
            <span className="h-px flex-1" style={{ background: colors.accent, opacity: 0.5 }} />
          </div>,
          0.5,
        )}

        {wrap(<p className="font-display text-xl sm:text-2xl" style={{ fontStyle: "italic" }}>{fmtDate(dateIso, { month: "long", day: "numeric", year: "numeric" })}</p>, 0.58)}
        {wrap(<p className="mt-2 text-[0.85rem] font-semibold opacity-85">{cfg.venueLine}</p>, 0.64)}

        {(cfg.rsvp || rsvpSlot) && (
          <div className="mt-8 w-full max-w-[380px]">
            {rsvpSlot ?? (
              wrap(
                <div className={`rounded-2xl border px-6 py-5 ${""}`} style={{ borderColor: `${colors.accent}55`, background: `${colors.accent}0F` }}>
                  <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.26em]" style={{ color: colors.accent }}>Kindly reply</p>
                  <p className="mt-1.5 text-[0.8rem] opacity-75">Your answer helps us set every table with care.</p>
                  <span className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2 text-[0.8rem] font-bold" style={{ background: colors.ink, color: colors.bg }}>
                    RSVP <Heart size={11} fill="currentColor" />
                  </span>
                  {cfg.meal && <p className="mt-2 text-[0.64rem] opacity-60">Meal selection included · notes welcome</p>}
                </div>,
                0.72,
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ live preview experience ------------------------------ */

function LivePreview({ onClose }: { onClose: () => void }) {
  const { db } = useApp();
  const template = seedTemplates.find((t) => t.id === db.invitation.templateId) ?? seedTemplates[0];
  const colors = resolveColors(template, db.invitation.colors);
  const serif = db.invitation.fontSerif ?? template.serif;
  const animated = db.plan === "luxe";
  const reduced = usePrefersReducedMotion();
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [rsvpState, setRsvpState] = useState<"idle" | "done">("idle");
  const [attending, setAttending] = useState<"yes" | "no" | null>(null);
  const [meal, setMeal] = useState(MEALS[0]);
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const { playing, start, stop } = useChimeLoop();

  const target = useMemo(() => new Date(db.wedding.date).getTime(), [db.wedding.date]);
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setCountdown({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff / 3600000) % 24),
        m: Math.floor((diff / 60000) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const width = device === "mobile" ? "w-[360px]" : device === "tablet" ? "w-[640px]" : "w-full max-w-[980px]";
  const fontFamily = serif ? "'Playfair Display', Georgia, serif" : "'Nunito Sans', sans-serif";

  return (
    <motion.div
      className="fixed inset-0 z-[85] overflow-y-auto bg-ink/80 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      role="dialog" aria-modal="true" aria-label="Live invitation preview"
    >
      <div className="sticky top-0 z-20 flex items-center justify-center gap-2 border-b border-cream/10 bg-ink/85 px-4 py-3 backdrop-blur">
        <Pill tone="gold"><Sparkles size={11} /> Live preview</Pill>
        <div className="mx-2 flex rounded-full bg-cream/10 p-1">
          {([["mobile", Smartphone], ["tablet", Tablet], ["desktop", Monitor]] as const).map(([d, Icon]) => (
            <button key={d} onClick={() => setDevice(d)} aria-label={`${d} preview`} className={`rounded-full p-2 transition cursor-pointer ${device === d ? "bg-cream text-ink" : "text-cream/60 hover:text-cream"}`}>
              <Icon size={14} />
            </button>
          ))}
        </div>
        <button
          onClick={() => (playing ? stop() : start())}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.72rem] font-bold transition cursor-pointer ${playing ? "bg-blush text-ink" : "bg-cream/10 text-cream hover:bg-cream/20"}`}
        >
          {playing ? <StopCircle size={13} /> : <Play size={13} />} {playing ? "Music on" : "Play music"}
        </button>
        <button onClick={onClose} aria-label="Close live preview" className="ml-2 rounded-full bg-cream/10 p-2 text-cream transition hover:bg-cream/25 cursor-pointer">
          <X size={15} />
        </button>
      </div>

      <div className="flex justify-center px-4 py-8">
        <div className={`${width} transition-all duration-500 overflow-hidden rounded-[1.4rem] shadow-glass`}>
          <div style={{ background: colors.bg, color: colors.ink, fontFamily }}>
            {/* hero reveal */}
            <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden px-8 py-20 text-center">
              {animated && !reduced && (
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                  {[8, 22, 38, 55, 70, 86, 94].map((left, i) => (
                    <span key={left} className="inv-petal" style={{ left: `${left}%`, animationDuration: `${7 + i * 1.6}s`, animationDelay: `${i}s` }} />
                  ))}
                </div>
              )}
              <motion.div initial={reduced ? false : { opacity: 0, scale: 0.7, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}>
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.5em]" style={{ color: colors.accent }}>Together with their families</p>
                <h2 className="mt-5 text-5xl leading-[1.05] sm:text-6xl" style={{ fontWeight: serif ? 600 : 800 }}>
                  {db.invitation.names.split("&")[0]?.trim()} <em style={{ color: colors.accent }}>&</em> {db.invitation.names.split("&")[1]?.trim()}
                </h2>
                <p className="mt-5 text-[0.95rem] tracking-wide opacity-80">{fmtDate(db.wedding.date)} · {db.wedding.venue}</p>
              </motion.div>

              {/* countdown */}
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }}
                className="mt-10 flex gap-3 sm:gap-5"
                aria-label="Countdown to the wedding"
              >
                {[["days", countdown.d], ["hrs", countdown.h], ["min", countdown.m], ["sec", countdown.s]].map(([label, v]) => (
                  <div key={label as string} className="w-16 rounded-2xl border px-2 py-3 sm:w-20" style={{ borderColor: `${colors.accent}55`, background: `${colors.accent}0F` }}>
                    <p className="font-display text-2xl tabular-nums sm:text-3xl">{String(v).padStart(2, "0")}</p>
                    <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.2em] opacity-60">{label}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* slideshow */}
            <div className="grid gap-1 sm:grid-cols-2">
              {[IMAGES.couple, IMAGES.hands].map((src, i) => (
                <motion.div
                  key={src} className="relative h-56 overflow-hidden sm:h-72"
                  initial={reduced ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.25 }}
                >
                  <SafeImg src={src} alt={`Maya and Theo, photo ${i + 1}`} className="h-full w-full object-cover transition-transform duration-[3s] hover:scale-105" />
                </motion.div>
              ))}
            </div>

            {/* details + rsvp */}
            <div className="grid gap-8 px-8 py-14 text-center sm:grid-cols-2 sm:px-14">
              <motion.div initial={reduced ? false : { opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.35em]" style={{ color: colors.accent }}>The details</p>
                <h3 className="mt-3 font-display text-2xl">Ceremony at four</h3>
                <p className="mt-2 text-[0.88rem] leading-relaxed opacity-75">{db.wedding.venue} · {db.wedding.location}. Cocktails on the terrace as the light turns gold, dinner under the glass, dancing until the trains stop.</p>
              </motion.div>

              <motion.div initial={reduced ? false : { opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.15 }}>
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.35em]" style={{ color: colors.accent }}>RSVP</p>
                {rsvpState === "done" ? (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mt-4 rounded-2xl border px-6 py-8" style={{ borderColor: `${colors.accent}66` }}>
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 14 }} className="inline-block">
                      <Heart size={34} style={{ color: colors.accent }} fill={colors.accent} />
                    </motion.span>
                    <p className="mt-3 font-display text-xl">{attending === "yes" ? "You're on the list" : "You'll be missed"}</p>
                    <p className="mt-1 text-[0.8rem] opacity-70">{attending === "yes" ? `We saved you a seat — ${meal} noted.` : "Thank you for letting us know."}</p>
                  </motion.div>
                ) : (
                  <div className="mt-4 rounded-2xl border px-6 py-6 text-left" style={{ borderColor: `${colors.accent}44`, background: `${colors.accent}0A` }}>
                    <p className="text-[0.82rem] font-bold">Will you join us?</p>
                    <div className="mt-2 flex gap-2">
                      {(["yes", "no"] as const).map((v) => (
                        <button key={v} onClick={() => setAttending(v)} className={`rounded-full border px-4 py-1.5 text-[0.78rem] font-bold transition cursor-pointer ${attending === v ? "" : "opacity-55 hover:opacity-90"}`} style={attending === v ? { background: colors.ink, color: colors.bg, borderColor: colors.ink } : { borderColor: `${colors.accent}66` }}>
                          {v === "yes" ? "Joyfully accept" : "Regretfully decline"}
                        </button>
                      ))}
                    </div>
                    {db.invitation.meal && attending === "yes" && (
                      <div className="mt-3">
                        <p className="text-[0.74rem] font-bold opacity-80">Your meal</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {MEALS.map((m) => (
                            <button key={m} onClick={() => setMeal(m)} className={`rounded-full border px-3 py-1 text-[0.7rem] font-bold transition cursor-pointer ${meal === m ? "" : "opacity-55 hover:opacity-90"}`} style={meal === m ? { background: colors.accent, color: colors.bg, borderColor: colors.accent } : { borderColor: `${colors.accent}55` }}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {db.invitation.notes && (
                      <textarea placeholder="A note for the couple…" className="mt-3 w-full rounded-xl border bg-transparent px-3 py-2 text-[0.8rem] placeholder:opacity-50 focus:outline-none" style={{ borderColor: `${colors.accent}44` }} aria-label="Note for the couple" />
                    )}
                    <button
                      disabled={!attending}
                      onClick={() => setRsvpState("done")}
                      className="mt-4 w-full rounded-full py-2.5 text-[0.82rem] font-bold transition disabled:opacity-40 cursor-pointer"
                      style={{ background: colors.ink, color: colors.bg }}
                    >
                      Send my answer
                    </button>
                  </div>
                )}
              </motion.div>
            </div>

            <p className="border-t px-8 py-6 text-center text-[0.7rem] tracking-[0.25em] opacity-50" style={{ borderColor: `${colors.accent}33` }}>
              MADE WITH LUMA · {db.website.domain.toUpperCase()}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------ main module ------------------------------ */

export default function Invitations() {
  const { db, patch, toast, openCheckout } = useApp();
  const [cat, setCat] = useState<string>("all");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [live, setLive] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStep, setSendStep] = useState<"compose" | "sending" | "done">("compose");
  const reduced = usePrefersReducedMotion();

  const cfg = db.invitation;
  const template = seedTemplates.find((t) => t.id === cfg.templateId) ?? seedTemplates[0];
  const colors = resolveColors(template, cfg.colors);
  const serif = cfg.fontSerif ?? template.serif;
  const isLuxeTemplate = !!template.luxe;
  const luxeUnlocked = db.plan === "luxe";
  const animated = isLuxeTemplate && luxeUnlocked;

  const confirmedCount = db.guests.filter((g) => g.rsvp === "confirmed").length;

  const setCfg = (p: Partial<typeof cfg>) => patch({ invitation: { ...cfg, ...p } });

  const templates = useMemo(() => seedTemplates.filter((t) => cat === "all" || t.cat === cat), [cat]);

  const choose = (t: Template) => {
    if (t.luxe && db.plan !== "luxe") {
      openCheckout("luxe");
      toast("That's a Luxe design", "Animated invitations unlock with Premium Luxe.", "info");
      return;
    }
    setCfg({ templateId: t.id, colors: null, fontSerif: null, photo: t.photo ? cfg.photo ?? t.photo : null });
    toast(`Template — ${t.name}`, "Make it yours on the right.");
  };

  const send = () => {
    setSendStep("sending");
    setTimeout(() => {
      setSendStep("done");
      setTimeout(() => {
        setSending(false);
        setSendStep("compose");
        toast("Invitations sent", `${confirmedCount} guests will find Luma in their inbox via Resend.`);
      }, 1400);
    }, 1600);
  };

  /* essential plan → locked */
  if (db.plan === "essential") {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-white/70 bg-white/60 p-10 text-center backdrop-blur-md">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-soft text-gold-deep"><Mail size={24} /></span>
        <h2 className="mt-5 font-display text-3xl text-ink">Invitations live in the <em className="text-blush-deep">Celebration Suite.</em></h2>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">Digital invitations, RSVP tracking, 20+ templates and guest messaging unlock with one upgrade — still no subscription.</p>
        <button onClick={() => openCheckout("celebration")} className={`${btn.gold} mt-7`}><Crown size={15} /> Unlock for {`$99`} one-time</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isLuxeTemplate && !luxeUnlocked && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold-soft/50 px-5 py-3.5">
          <Lock size={15} className="text-gold-deep" />
          <p className="text-[0.85rem] font-bold text-ink">This Luxe design previews statically — upgrade to set its petals, shimmer and motion loose.</p>
          <button onClick={() => openCheckout("luxe")} className="ml-auto rounded-full bg-ink px-4 py-2 text-[0.78rem] font-bold text-cream transition hover:bg-ink/85 cursor-pointer">Upgrade to Luxe</button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        {/* preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl text-ink">{template.name} <span className="text-base italic text-ink-mute">· {template.cat}</span></h2>
            <div className="flex rounded-full border border-ink/12 bg-white/70 p-1">
              {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
                <button key={d} onClick={() => setDevice(d)} aria-label={`${d} preview`} className={`rounded-full p-2 transition cursor-pointer ${device === d ? "bg-ink text-cream" : "text-ink-mute hover:text-ink"}`}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-white/70 bg-white/50 p-4 backdrop-blur-md sm:p-6">
            <div className={`mx-auto overflow-hidden rounded-[1.2rem] border border-ink/10 shadow-lift transition-all duration-500 ${device === "mobile" ? "max-w-[340px]" : device === "tablet" ? "max-w-[560px]" : "max-w-full"}`}>
              <div className="flex items-center gap-1.5 border-b border-ink/8 bg-white px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blush" /><span className="h-2.5 w-2.5 rounded-full bg-gold" /><span className="h-2.5 w-2.5 rounded-full bg-sage" />
                <span className="ml-3 rounded-full bg-ink/5 px-2.5 py-0.5 text-[0.62rem] font-bold text-ink-mute">invitation preview</span>
                {animated && <Pill tone="gold" className="ml-auto"><Sparkles size={10} /> animated</Pill>}
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                <InviteArt key={template.id + device} template={template} colors={colors} serif={serif} cfg={cfg} animated={animated && !reduced} dateIso={db.wedding.date} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => setLive(true)} className={`${btn.ink} !py-3`}><Play size={14} /> Live preview</button>
            <button onClick={() => { setSending(true); setSendStep("compose"); }} className={`${btn.blush} !py-3`}><Mail size={14} /> Send to {confirmedCount} guests</button>
          </div>
        </div>

        {/* controls */}
        <div className="space-y-5">
          <section className="rounded-[1.6rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md">
            <h3 className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute">Wording</h3>
            <div className="mt-4 space-y-3">
              <Field label="Names"><input className={inputCls} value={cfg.names} onChange={(e) => setCfg({ names: e.target.value })} /></Field>
              <Field label="Opening line"><input className={inputCls} value={cfg.line1} onChange={(e) => setCfg({ line1: e.target.value })} /></Field>
              <Field label="Invitation line"><input className={inputCls} value={cfg.line2} onChange={(e) => setCfg({ line2: e.target.value })} /></Field>
              <Field label="Venue line"><input className={inputCls} value={cfg.venueLine} onChange={(e) => setCfg({ venueLine: e.target.value })} /></Field>
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md">
            <h3 className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute">Colors & type</h3>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button onClick={() => setCfg({ colors: null })} aria-label="Template default colors" className={`h-9 w-9 rounded-full border-2 transition cursor-pointer ${cfg.colors === null ? "border-ink scale-110" : "border-white shadow-sm"}`} style={{ background: `linear-gradient(135deg, ${template.bg} 50%, ${template.accent} 50%)` }} />
              {PALETTES.map((p) => (
                <button key={p.name} onClick={() => setCfg({ colors: p })} aria-label={`${p.name} palette`} title={p.name}
                  className={`h-9 w-9 rounded-full border-2 transition cursor-pointer ${cfg.colors && cfg.colors.bg === p.bg && cfg.colors.accent === p.accent ? "border-ink scale-110" : "border-white shadow-sm hover:scale-105"}`}
                  style={{ background: `linear-gradient(135deg, ${p.bg} 45%, ${p.accent} 45%)` }} />
              ))}
            </div>
            <div className="mt-4 flex rounded-full bg-ink/5 p-1 text-[0.78rem] font-bold">
              <button onClick={() => setCfg({ fontSerif: true })} className={`flex-1 rounded-full py-2 transition cursor-pointer ${serif ? "bg-white shadow-sm text-ink" : "text-ink-mute"}`}>Classic serif</button>
              <button onClick={() => setCfg({ fontSerif: false })} className={`flex-1 rounded-full py-2 transition cursor-pointer ${!serif ? "bg-white shadow-sm text-ink" : "text-ink-mute"}`}>Modern sans</button>
            </div>
          </section>

          <section className="rounded-[1.6rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md">
            <h3 className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute">RSVP options</h3>
            <div className="mt-4 space-y-2.5">
              {([["rsvp", "RSVP button"], ["meal", "Meal selection"], ["notes", "Guest notes"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setCfg({ [key]: !cfg[key] } as Partial<typeof cfg>)} aria-pressed={cfg[key]}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-[0.85rem] font-bold transition cursor-pointer ${cfg[key] ? "border-sage/60 bg-sage-soft/60 text-ink" : "border-ink/12 text-ink-mute hover:border-ink/30"}`}>
                  {label}
                  <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${cfg[key] ? "bg-sage-deep" : "bg-ink/15"}`}>
                    <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${cfg[key] ? "translate-x-4" : ""}`} />
                  </span>
                </button>
              ))}
            </div>
          </section>

          {template.photo && (
            <section className="rounded-[1.6rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md">
              <h3 className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute">Photo</h3>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {PHOTO_CHOICES.map((p) => (
                  <button key={p.label} onClick={() => setCfg({ photo: p.src })} aria-label={`Use ${p.label}`} title={p.label}
                    className={`overflow-hidden rounded-xl border-2 transition cursor-pointer ${cfg.photo === p.src ? "border-gold" : "border-transparent opacity-80 hover:opacity-100"}`}>
                    <img src={p.src} alt={p.label} className="h-14 w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* template gallery */}
      <section aria-label="Invitation templates">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-3 font-display text-2xl text-ink">Templates</h2>
          {["all", ...TEMPLATE_CATS].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full px-4 py-2 text-[0.76rem] font-bold capitalize transition cursor-pointer ${cat === c ? "bg-ink text-cream shadow-card" : "border border-ink/15 bg-white/60 text-ink-2 hover:border-ink/40"}`}>
              {c}
            </button>
          ))}
          <Pill tone="gold" className="ml-auto">{seedTemplates.length} designs</Pill>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {templates.map((t) => {
            const c = resolveColors(t, null);
            const active = t.id === cfg.templateId;
            const locked = t.luxe && !luxeUnlocked;
            return (
              <button
                key={t.id}
                onClick={() => choose(t)}
                aria-pressed={active}
                className={`group relative overflow-hidden rounded-[1.2rem] border-2 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lift cursor-pointer ${active ? "border-gold shadow-card" : "border-transparent"}`}
              >
                <div className="aspect-[4/5] w-full" style={{ background: c.bg, color: c.ink }}>
                  {t.photo ? (
                    <img src={t.photo} alt={`${t.name} template`} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center">
                      <span className="h-6 w-10 rounded-t-full border-t-2" style={{ borderColor: c.accent }} aria-hidden="true" />
                      <span className="font-display text-lg leading-tight" style={{ fontFamily: t.serif ? "'Playfair Display', serif" : "'Nunito Sans', sans-serif", fontWeight: t.serif ? 600 : 800 }}>M <em style={{ color: c.accent }}>&</em> T</span>
                      <span className="text-[0.5rem] font-extrabold uppercase tracking-[0.3em]" style={{ color: c.accent }}>Save the date</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between bg-white/90 px-3 py-2 backdrop-blur">
                  <span className="text-[0.7rem] font-extrabold text-ink">{t.name}</span>
                  {t.luxe && <span className="text-gold-deep">{locked ? <Lock size={11} /> : <Crown size={11} />}</span>}
                </div>
                {active && (
                  <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-ink shadow-card"><Check size={11} strokeWidth={3.5} /></span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* send modal */}
      <Modal open={sending} onClose={() => sendStep !== "sending" && setSending(false)} label="Send invitations">
        <div className="p-7 sm:p-8">
          {sendStep === "compose" && (
            <>
              <h2 className="flex items-center gap-2.5 font-display text-2xl text-ink"><Mail size={20} className="text-blush-deep" /> Send "{template.name}"</h2>
              <p className="mt-2 text-[0.85rem] font-semibold text-ink-2">Delivered by email via Resend to every confirmed guest, with RSVP tracking wired in.</p>
              <div className="mt-5 rounded-2xl border border-ink/10 bg-white/70 p-4 text-[0.85rem]">
                <p className="font-bold text-ink">{confirmedCount} recipients</p>
                <p className="mt-1 text-ink-mute">Subject: "Maya & Theo — you're invited ♥"</p>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setSending(false)} className={btn.ghost}>Cancel</button>
                <button onClick={send} className={btn.ink}><Mail size={14} /> Send invitations</button>
              </div>
            </>
          )}
          {sendStep === "sending" && (
            <div className="flex flex-col items-center py-8 text-ink-2">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }} className="h-10 w-10 rounded-full border-2 border-gold border-t-transparent" />
              <p className="mt-4 text-sm font-bold">Sealing {confirmedCount} envelopes…</p>
            </div>
          )}
          {sendStep === "done" && (
            <div className="flex flex-col items-center py-8">
              <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-soft text-sage-deep">
                <Check size={26} strokeWidth={3} />
              </motion.span>
              <p className="mt-4 font-display text-xl text-ink">On their way</p>
            </div>
          )}
        </div>
      </Modal>

      <AnimatePresence>{live && <LivePreview onClose={() => setLive(false)} />}</AnimatePresence>
    </div>
  );
}
