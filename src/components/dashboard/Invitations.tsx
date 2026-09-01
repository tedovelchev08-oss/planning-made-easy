import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, Check, Copy, Crown, Heart, Instagram, Link2, Lock, Mail, MessageCircle, Monitor,
  Music, Play, Send, Share2, Smartphone, Sparkles, StopCircle, Tablet, Trash2, UploadCloud, X,
} from "lucide-react";
import { Guest, MEALS, MUSIC_TRACKS, RsvpEntry, TEMPLATE_CATS, Template, bestGuestMatch, fmtDate, seedTemplates, timeAgo } from "../../lib/data";
import { IMAGES } from "../../lib/images";
import { inviteLink, useApp, usePrefersReducedMotion } from "../../lib/store";
import { playChime, useChimeLoop } from "../../lib/sound";
import { DesignFrame, Field, Modal, Pill, Reveal, SafeImg, btn, inputCls } from "../ui";
import type { CustomTemplate } from "../../lib/data";

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

export function InviteArt({
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
  const activeCustom = db.customTemplates.find((c) => c.id === db.invitation.templateId) ?? null;
  const musicCfg = db.invitation.music;
  const hasUpload = musicCfg.track === "upload" && !!musicCfg.uploadData;
  const { playing, start, stop } = useChimeLoop(musicCfg.track === "upload" ? "serene" : musicCfg.track);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [uploadPlaying, setUploadPlaying] = useState(false);

  const toggleMusic = () => {
    if (hasUpload && audioRef.current) {
      if (uploadPlaying) { audioRef.current.pause(); setUploadPlaying(false); }
      else { audioRef.current.currentTime = 0; void audioRef.current.play().catch(() => {}); setUploadPlaying(true); }
      return;
    }
    if (playing) stop(); else start();
  };

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
          onClick={toggleMusic}
          aria-label={playing || uploadPlaying ? "Stop music" : "Play music"}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.72rem] font-bold transition cursor-pointer ${playing || uploadPlaying ? "bg-blush text-ink" : "bg-cream/10 text-cream hover:bg-cream/20"}`}
        >
          {playing || uploadPlaying ? <StopCircle size={13} /> : <Play size={13} />}
          {playing || uploadPlaying ? "Music on" : hasUpload ? `Play “${musicCfg.uploadName}”` : "Play music"}
        </button>
        <button onClick={onClose} aria-label="Close live preview" className="ml-2 rounded-full bg-cream/10 p-2 text-cream transition hover:bg-cream/25 cursor-pointer">
          <X size={15} />
        </button>
      </div>

      <div className="flex justify-center px-4 py-8">
        <div className={`${width} transition-all duration-500 overflow-hidden rounded-[1.4rem] shadow-glass`}>
          <div style={{ background: colors.bg, color: colors.ink, fontFamily }}>
            {/* hero reveal */}
            {activeCustom ? (
              <CustomHero custom={activeCustom} colors={colors} countdown={countdown} reduced={reduced} />
            ) : (
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
            )}

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
      {hasUpload && <audio ref={audioRef} src={musicCfg.uploadData ?? undefined} loop onEnded={() => setUploadPlaying(false)} className="hidden" />}
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
  const [importOpen, setImportOpen] = useState(false);
  const reduced = usePrefersReducedMotion();

  const cfg = db.invitation;
  const activeCustom = db.customTemplates.find((c) => c.id === cfg.templateId) ?? null;
  const isHtmlDesign = !!activeCustom?.html;
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
            <h2 className="font-display text-2xl text-ink">
              {activeCustom ? activeCustom.name : template.name}{" "}
              <span className="text-base italic text-ink-mute">· {activeCustom ? "your design" : template.cat}</span>
            </h2>
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
                {activeCustom ? (
                  activeCustom.html ? (
                    <div>
                      <DesignFrame html={activeCustom.html} title={`${activeCustom.name} — live invitation`} className="h-[540px] bg-white" />
                      <div className="border-t border-ink/8 bg-white px-5 py-3.5 text-[0.76rem] font-semibold text-ink-2">
                        A <em className="font-display italic text-ink">live</em> Luxe original — fully interactive above. RSVP, meals and notes still collect on the guest page beneath it.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <img src={activeCustom.dataUrl ?? ""} alt={`${activeCustom.name} — your invitation design`} className="w-full" />
                      <div className="border-t border-ink/8 bg-white px-5 py-3.5 text-[0.76rem] font-semibold text-ink-2">
                        A Luxe original — your artwork <em className="font-display italic text-ink">is</em> the invitation. Wording stays off-card; RSVP, meals and notes still collect on the guest page beneath it.
                      </div>
                    </div>
                  )
                ) : (
                  <InviteArt key={template.id + device} template={template} colors={colors} serif={serif} cfg={cfg} animated={animated && !reduced} dateIso={db.wedding.date} />
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => setLive(true)} className={`${btn.ink} !py-3`}><Play size={14} /> Live preview</button>
            <a href="#/invite" target="_blank" rel="noreferrer" className={`${btn.outline} !py-3`}><Link2 size={14} /> Guest page</a>
            <button onClick={() => { setSending(true); setSendStep("compose"); }} className={`${btn.blush} !py-3`}><Mail size={14} /> Send to {confirmedCount} guests</button>
          </div>
        </div>

        {/* controls */}
        <div className="space-y-5">
          {isHtmlDesign ? (
            <section className="rounded-[1.6rem] border border-gold/40 bg-gold-soft/40 p-6 backdrop-blur-md">
              <h3 className="flex items-center gap-2 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-gold-deep">
                <Sparkles size={12} /> Live HTML design
              </h3>
              <p className="mt-3 text-[0.85rem] leading-relaxed text-ink-2">
                This original brings its own look, wording and interactions — nothing to restyle here.
                RSVP collection, meals, notes, music and motion below still wrap around it on the guest page.
              </p>
            </section>
          ) : (
          <>
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
          </>
          )}

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

          <LuxeStudio cfg={cfg} setCfg={setCfg} unlocked={luxeUnlocked} />

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
          <Pill tone="gold">{seedTemplates.length + db.customTemplates.length} designs</Pill>
          <button onClick={() => setImportOpen(true)} className={`${btn.outline} ml-auto !px-4 !py-2 text-[0.78rem]`}>
            <UploadCloud size={14} /> Add Luxe designs
          </button>
        </div>

        {db.customTemplates.length > 0 && (
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="flex items-center gap-2 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-gold-deep">
                <Crown size={12} /> Luxe collection · {db.customTemplates.length}
              </p>
              <p className="text-[0.68rem] font-semibold text-ink-mute">Owner-curated originals · bundled with Premium Luxe{!luxeUnlocked && " · locked on your plan"}</p>
            </div>
            <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
              {db.customTemplates.map((c) => {
                const active = c.id === cfg.templateId;
                const locked = !luxeUnlocked;
                return (
                  <div key={c.id} className={`group relative w-36 shrink-0 overflow-hidden rounded-[1.1rem] border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift ${active ? "border-gold shadow-card" : "border-transparent"}`}>
                    <button
                      onClick={() => {
                        if (locked) {
                          openCheckout("luxe");
                          toast("A Luxe original", `${c.name} unlocks with Premium Luxe.`, "info");
                          return;
                        }
                        setCfg({ templateId: c.id, colors: null, fontSerif: null });
                        playChime("place");
                        toast(`Design — ${c.name}`, "Your original, front and center.");
                      }}
                      aria-pressed={active}
                      className="block w-full cursor-pointer"
                    >
                      <span className="relative block">
                        {c.html ? (
                          <div className={`aspect-[4/5] w-full transition duration-500 ${locked ? "opacity-80 saturate-[0.55]" : ""}`}>
                            <DesignFrame html={c.html} title={`${c.name} preview`} interactive={false} thumbWidth={144} thumbHeight={180} />
                          </div>
                        ) : (
                          <img src={c.dataUrl ?? ""} alt={c.name} className={`aspect-[4/5] w-full object-cover transition duration-500 ${locked ? "opacity-80 saturate-[0.55]" : ""}`} />
                        )}
                        {c.html && !locked && (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/85 px-2 py-0.5 text-[0.52rem] font-extrabold uppercase tracking-[0.14em] text-gold shadow-card">Live HTML</span>
                        )}
                        {locked && (
                          <span className="absolute inset-0 flex items-center justify-center bg-ink/25">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream/90 text-gold-deep shadow-card"><Lock size={13} /></span>
                          </span>
                        )}
                      </span>
                      <span className="flex items-center justify-between bg-white/95 px-2.5 py-1.5">
                        <span className="truncate text-[0.68rem] font-extrabold text-ink">{c.name}</span>
                        {active ? <Check size={11} strokeWidth={3.5} className="shrink-0 text-gold-deep" /> : <Crown size={11} className="shrink-0 text-gold-deep" />}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        const remaining = db.customTemplates.filter((x) => x.id !== c.id);
                        patch({ customTemplates: remaining, invitation: cfg.templateId === c.id ? { ...cfg, templateId: seedTemplates[0].id } : cfg });
                        toast(`${c.name} removed from the Luxe bundle`, undefined, "info");
                      }}
                      aria-label={`Remove ${c.name} from the Luxe collection`}
                      title="Owner only — remove from the Luxe bundle"
                      className="absolute right-1.5 top-1.5 rounded-full bg-ink/80 p-1.5 text-cream opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:bg-blush-deep cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

      <ImportDesignsModal open={importOpen} onClose={() => setImportOpen(false)} />
      <AnimatePresence>{live && <LivePreview onClose={() => setLive(false)} />}</AnimatePresence>
    </div>
  );
}

/* ------------------------------ share link card ------------------------------ */

/** The link that actually resolves to the couple's guest page on this deployment. */
export const pageLink = (slug: string, params?: Record<string, string>) => {
  const base = `${window.location.origin}${window.location.pathname}#/invite`;
  const q = new URLSearchParams(params ?? (slug ? { slug } : {})).toString();
  return q ? `${base}?${q}` : base;
};

export function ShareCard() {
  const { db, toast } = useApp();
  const [copied, setCopied] = useState(false);
  // cloud links carry the real slug so any device lands on this couple's page;
  // demo keeps the canonical luma.love vanity link
  const link = db.wedding.slug ? pageLink(db.wedding.slug) : inviteLink(db.wedding.names);
  const dateStr = fmtDate(db.wedding.date, { month: "long", day: "numeric", year: "numeric" });
  const messageFor = (src: string) =>
    `${db.wedding.names} are getting married — ${dateStr} at ${db.wedding.venue}. RSVP in one tap: ${link}${db.wedding.slug ? `&src=${src}` : ""}`;
  const message = messageFor("link");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      playChime("place");
      toast("Link copied", "Paste it anywhere — WhatsApp, Instagram, a group chat…");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast("Copy this link", link, "info");
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) { copy(); return; }
    try { await navigator.share({ title: `${db.wedding.names} — you're invited`, text: message, url: link }); }
    catch { /* dismissed */ }
  };

  const channels = [
    { label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(messageFor("whatsapp"))}`, tint: "hover:border-[#25D366]/70 hover:text-[#128C4A]" },
    { label: "Instagram", icon: Instagram, href: "https://www.instagram.com/", copyFirst: true, tint: "hover:border-blush-deep/70 hover:text-blush-deep" },
    { label: "Messenger", icon: Send, href: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(link + (db.wedding.slug ? "&src=messenger" : ""))}&app_id=140586622674265&redirect_uri=${encodeURIComponent(link)}`, tint: "hover:border-lav-deep/70 hover:text-lav-deep" },
    { label: "Text", icon: MessageCircle, href: `sms:?&body=${encodeURIComponent(messageFor("link"))}`, tint: "hover:border-sage-deep/70 hover:text-sage-deep" },
    { label: "Email", icon: Mail, href: `mailto:?subject=${encodeURIComponent(`${db.wedding.names} — you're invited ♥`)}&body=${encodeURIComponent(messageFor("email"))}`, tint: "hover:border-gold-deep/70 hover:text-gold-deep" },
  ];

  return (
    <section aria-label="Share your wedding page" className="relative overflow-hidden rounded-[1.8rem] bg-ink p-6 text-cream shadow-lift sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blush/25 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-lav/20 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[0.66rem] font-extrabold uppercase tracking-[0.22em] text-gold">
            <Share2 size={12} /> Share the wedding page
          </p>
          <h2 className="mt-2 font-display text-2xl leading-snug sm:text-[1.7rem]">
            One link. <em className="text-blush">Everything.</em>
          </h2>
          <p className="mt-2 max-w-md text-[0.85rem] font-semibold leading-relaxed text-cream/60">
            Guests land on your page — the invitation, your story, the schedule, the registry — and RSVP right there.
            Drop the link in WhatsApp, an Instagram DM, a family group chat; every answer lands in the RSVPs tab.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {channels.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                onClick={() => { if (c.copyFirst) copy(); }}
                className={`inline-flex items-center gap-1.5 rounded-full border border-cream/20 px-3.5 py-2 text-[0.74rem] font-bold text-cream/85 transition-all duration-300 hover:bg-cream/10 ${c.tint}`}
              >
                <c.icon size={13} /> {c.label}
              </a>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-[380px]">
          <div className="flex items-center gap-2 rounded-2xl border border-cream/20 bg-cream/10 p-2 pl-4 backdrop-blur">
            <Link2 size={14} className="shrink-0 text-gold" />
            <span className="min-w-0 flex-1 truncate font-mono text-[0.78rem] text-cream/90" title={link}>{link.replace("https://", "")}</span>
            <button
              onClick={copy}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[0.78rem] font-extrabold transition-all duration-300 active:scale-95 cursor-pointer ${copied ? "bg-sage text-ink" : "bg-gold text-ink hover:brightness-110"}`}
            >
              {copied ? <Check size={13} strokeWidth={3.4} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={nativeShare} className="mt-2.5 w-full rounded-2xl border border-cream/20 py-2.5 text-[0.78rem] font-bold text-cream/80 transition hover:bg-cream/10 cursor-pointer">
            Or use your phone's share sheet
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ RSVP tracker ------------------------------ */

const SOURCE_META: Record<string, { icon: typeof Link2; label: string; cls: string }> = {
  link: { icon: Link2, label: "Link", cls: "bg-gold-soft text-gold-deep" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", cls: "bg-sage-soft text-sage-deep" },
  instagram: { icon: Instagram, label: "Instagram", cls: "bg-blush-soft text-blush-deep" },
  messenger: { icon: Send, label: "Messenger", cls: "bg-lav-soft text-lav-deep" },
  email: { icon: Mail, label: "Email", cls: "bg-ink/6 text-ink-2" },
};

/** Copies a guest's personal invite link — their name arrives pre-filled. */
function PersonalLinkButton({ guest, token }: { guest: string; token: string }) {
  const { toast } = useApp();
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        const url = pageLink("", { token });
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          playChime("place");
          toast(`${guest}'s link copied`, "Send it straight to them — their name comes pre-filled.");
          setTimeout(() => setCopied(false), 1800);
        } catch {
          toast(`${guest}'s link`, url, "info");
        }
      }}
      aria-label={`Copy personal invite link for ${guest}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[0.66rem] font-extrabold transition cursor-pointer ${copied ? "bg-sage text-ink" : "bg-ink text-cream hover:bg-ink/85"}`}
    >
      {copied ? <Check size={11} strokeWidth={3.4} /> : <Copy size={11} />} {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function RsvpTracker() {
  const { db, patch, toast } = useApp();
  const [reminding, setReminding] = useState(false);
  const log = [...db.rsvpLog].sort((a, b) => b.at - a.at);
  const confirmed = db.guests.filter((g) => g.rsvp === "confirmed").length;
  const declined = db.guests.filter((g) => g.rsvp === "declined").length;
  const waiting = db.guests.filter((g) => g.rsvp === "pending").length;

  /** fuzzy resolution: exact → fuzzy (≥ floor) → brand-new */
  const matchFor = useCallback((e: RsvpEntry): { guest: Guest | null; score: number; exact: boolean } => {
    const exact = db.guests.find((g) => g.name.toLowerCase() === e.name.toLowerCase());
    if (exact) return { guest: exact, score: 1, exact: true };
    const m = bestGuestMatch(e.name, db.guests.filter((g) => !g.plusOneOf));
    if (m) return { guest: m.guest, score: m.score, exact: false };
    return { guest: null, score: 0, exact: false };
  }, [db.guests]);

  const unsynced = log.filter((e) => !e.synced && matchFor(e).guest !== null);

  /** the guest records an entry produces when synced: host update + optional linked plus-one */
  const buildSync = useCallback((guests: Guest[], entry: RsvpEntry, host: Guest): Guest[] => {
    const updatedHost: Guest = {
      ...host,
      rsvp: entry.answer === "yes" ? "confirmed" : "declined",
      meal: entry.meal ?? host.meal,
      notes: entry.note ? `${host.notes ? host.notes + " · " : ""}RSVP: ${entry.note}` : host.notes,
    };
    let out = guests.map((g) => (g.id === host.id ? updatedHost : g));
    if (entry.answer === "yes" && entry.plusOne?.trim()) {
      const poName = entry.plusOne.trim();
      if (!out.some((g) => g.plusOneOf === host.id)) {
        out = [...out, {
          id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: poName, party: host.party, rsvp: "confirmed",
          meal: entry.plusOneMeal ?? null, table: host.table, seat: null,
          plusOneOf: host.id, dietary: null,
          notes: `Plus-one of ${host.name.split(" ")[0]} — added from RSVP`,
        }];
      }
    }
    return out;
  }, []);

  const apply = (entryId: string, targetId?: string) => {
    const entry = db.rsvpLog.find((e) => e.id === entryId);
    if (!entry) return;
    const host = targetId ? db.guests.find((g) => g.id === targetId) : matchFor(entry).guest;
    if (!host) return;
    patch({
      guests: buildSync(db.guests, entry, host),
      rsvpLog: db.rsvpLog.map((e) => (e.id === entryId ? { ...e, synced: true } : e)),
    });
    playChime("done");
    const po = entry.answer === "yes" && entry.plusOne?.trim() ? ` + ${entry.plusOne.trim()}` : "";
    toast(`${entry.name}${po} synced`, "Their answer now counts in your guest list.");
  };

  /** genuinely unknown name → create a real guest (plus their plus-one) */
  const addAsNewGuest = (entryId: string) => {
    const entry = db.rsvpLog.find((e) => e.id === entryId);
    if (!entry) return;
    const host: Guest = {
      id: `g-${Date.now()}`,
      name: entry.name.trim(), party: "S",
      rsvp: entry.answer === "yes" ? "confirmed" : "declined",
      meal: entry.meal, table: null, seat: null, plusOneOf: null, dietary: null,
      notes: entry.note ? `Added from RSVP · ${entry.note}` : "Added from RSVP",
    };
    let guests: Guest[] = [host, ...db.guests];
    if (entry.answer === "yes" && entry.plusOne?.trim()) {
      guests = [{
        id: `g-${Date.now()}-po`,
        name: entry.plusOne.trim(), party: "S", rsvp: "confirmed",
        meal: entry.plusOneMeal ?? null, table: null, seat: null,
        plusOneOf: host.id, dietary: null,
        notes: `Plus-one of ${host.name.split(" ")[0]}`,
      }, ...guests];
    }
    patch({
      guests,
      rsvpLog: db.rsvpLog.map((e) => (e.id === entryId ? { ...e, synced: true } : e)),
    });
    playChime("place");
    toast(`${entry.name} joined the guest list`, entry.plusOne ? "Their plus-one was added too." : undefined);
  };

  /** auto-sync only confident (exact) matches; fuzzy + new wait for review */
  const syncAll = () => {
    let guests = db.guests;
    let applied = 0;
    const syncedIds: string[] = [];
    for (const e of db.rsvpLog) {
      if (e.synced) continue;
      const m = matchFor(e);
      if (!m.guest || !m.exact) continue;
      guests = buildSync(guests, e, m.guest);
      applied++;
      syncedIds.push(e.id);
    }
    if (!applied) {
      toast("Nothing auto-synced", "The rest need a glance — they're fuzzy matches or new guests.", "info");
      return;
    }
    patch({ guests, rsvpLog: db.rsvpLog.map((e) => (syncedIds.includes(e.id) ? { ...e, synced: true } : e)) });
    playChime("sparkle");
    toast("Confident RSVPs synced", `${applied} merged — fuzzy ones are below for a quick yes/no.`);
  };

  const remind = () => {
    setReminding(true);
    setTimeout(() => {
      setReminding(false);
      toast("Reminders on their way", `${waiting} pending guests will get a gentle nudge via Resend and SMS.`);
    }, 1100);
  };

  return (
    <section aria-label="RSVP tracker" className="rounded-[1.8rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md sm:p-8">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blush-soft text-blush-deep"><Activity size={19} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl text-ink">Who's coming?</h2>
          <p className="text-[0.8rem] font-semibold text-ink-mute">Every answer from your link, messages and emails — as it happens.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={remind} disabled={reminding || waiting === 0} className="rounded-full border border-ink/15 px-4 py-2 text-[0.76rem] font-bold text-ink-2 transition hover:border-blush-deep hover:text-blush-deep disabled:opacity-40 cursor-pointer">
            {reminding ? "Sending…" : `Remind ${waiting} pending`}
          </button>
          {unsynced.length > 0 && (
            <button onClick={syncAll} className="rounded-full bg-ink px-4 py-2 text-[0.76rem] font-bold text-cream transition hover:bg-ink/85 cursor-pointer">
              Sync {unsynced.length} to guest list
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { label: "Joyfully yes", value: confirmed, cls: "text-sage-deep", bar: "bg-sage" },
          { label: "Still deciding", value: waiting, cls: "text-blush-deep", bar: "bg-blush" },
          { label: "With love, no", value: declined, cls: "text-ink-mute", bar: "bg-ink/30" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-ink/8 bg-white/70 p-4">
            <p className={`font-display text-3xl ${s.cls}`}>{s.value}</p>
            <p className="mt-0.5 text-[0.68rem] font-extrabold uppercase tracking-[0.14em] text-ink-mute">{s.label}</p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/8">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(s.value / Math.max(1, db.guests.length)) * 100}%` }} transition={{ duration: 1 }} className={`h-full rounded-full ${s.bar}`} />
            </div>
          </div>
        ))}
      </div>

      {/* per-guest personal links — the fastest way to convert the undecided */}
      {(() => {
        const pendingWithToken = db.guests.filter((g) => g.rsvp === "pending" && g.token);
        if (pendingWithToken.length === 0) return null;
        return (
          <div className="mt-5 rounded-2xl border border-gold/30 bg-gold-soft/35 p-5">
            <p className="flex items-center gap-2 text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-gold-deep">
              <Link2 size={12} /> Personal links · guests still deciding
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {pendingWithToken.slice(0, 6).map((g) => (
                <li key={g.id} className="flex items-center gap-2.5 rounded-xl border border-ink/8 bg-white/75 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[0.82rem] font-bold text-ink">{g.name}</span>
                  <PersonalLinkButton guest={g.name} token={g.token ?? ""} />
                </li>
              ))}
            </ul>
            {pendingWithToken.length > 6 && (
              <p className="mt-2.5 text-[0.7rem] font-semibold text-ink-mute">+{pendingWithToken.length - 6} more waiting on their own link</p>
            )}
          </div>
        );
      })()}

      {log.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-ink/15 px-5 py-8 text-center text-[0.88rem] font-semibold text-ink-mute">
          No RSVPs yet — share your link above and the answers will start rolling in here.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-ink/6">
          {log.map((e) => {
            const meta = SOURCE_META[e.source] ?? SOURCE_META.link;
            const Icon = meta.icon;
            const m = matchFor(e);
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-3.5 sm:flex-nowrap">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.62rem] font-extrabold ${e.answer === "yes" ? "bg-sage-soft text-sage-deep" : "bg-blush-soft text-blush-deep"}`}>
                  {e.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[0.9rem] font-bold text-ink">
                    {e.name}
                    <Pill tone={e.answer === "yes" ? "confirmed" : "declined"}>{e.answer === "yes" ? "attending" : "can't make it"}</Pill>
                    {e.meal && <span className="text-[0.68rem] font-bold text-ink-mute">· {e.meal}</span>}
                    {e.answer === "yes" && e.plusOne && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[0.64rem] font-extrabold text-gold-deep">+1 {e.plusOne}</span>
                    )}
                  </p>
                  {e.note && <p className="mt-0.5 truncate text-[0.78rem] italic text-ink-2">“{e.note}”</p>}
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.64rem] font-extrabold ${meta.cls}`}><Icon size={11} /> {meta.label}</span>
                <span className="text-[0.7rem] font-bold text-ink-mute">{timeAgo(e.at)}</span>
                {e.synced ? (
                  <span className="inline-flex items-center gap-1 text-[0.68rem] font-extrabold text-sage-deep"><Check size={12} strokeWidth={3} /> synced</span>
                ) : m.guest && m.exact ? (
                  <button onClick={() => apply(e.id)} className="rounded-full bg-gold px-3 py-1.5 text-[0.68rem] font-extrabold text-ink transition hover:brightness-105 cursor-pointer">Sync →</button>
                ) : m.guest ? (
                  <span className="flex items-center gap-1.5" title={`Fuzzy match — ${Math.round(m.score * 100)}% similar to ${m.guest.name}`}>
                    <span className="max-w-[110px] truncate text-[0.62rem] font-bold text-ink-mute">≈ {m.guest.name}</span>
                    <button onClick={() => apply(e.id, m.guest!.id)} className="rounded-full bg-gold px-2.5 py-1.5 text-[0.62rem] font-extrabold text-ink transition hover:brightness-105 cursor-pointer">Yes</button>
                    <button onClick={() => addAsNewGuest(e.id)} className="rounded-full border border-ink/20 px-2.5 py-1.5 text-[0.62rem] font-extrabold text-ink-2 transition hover:border-ink/50 cursor-pointer">New</button>
                  </span>
                ) : (
                  <button onClick={() => addAsNewGuest(e.id)} className="rounded-full border border-dashed border-ink/30 px-3 py-1.5 text-[0.64rem] font-extrabold text-ink-2 transition hover:border-gold hover:text-gold-deep cursor-pointer">+ add guest</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------ luxe studio ------------------------------ */

function LuxeStudio({ cfg, setCfg, unlocked }: {
  cfg: ReturnType<typeof useApp>["db"]["invitation"];
  setCfg: (p: Partial<ReturnType<typeof useApp>["db"]["invitation"]>) => void;
  unlocked: boolean;
}) {
  const { toast, openCheckout, patch, db } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const motion = cfg.motion;
  const music = cfg.music;

  const uploadTrack = async (file: File) => {
    if (!file.type.startsWith("audio/")) { toast("That's not audio", "MP3, WAV or M4A work best.", "warn"); return; }
    if (file.size > 2.5 * 1024 * 1024) { toast("A touch too big", "Keep tracks under 2.5 MB so invitations load instantly.", "warn"); return; }
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    }).catch(() => null);
    if (!dataUrl) return;
    setCfg({ music: { track: "upload", uploadName: file.name.replace(/\.[^.]+$/, ""), uploadData: dataUrl } });
    playChime("sparkle");
    toast("Your song is in", `“${file.name.replace(/\.[^.]+$/, "")}” will play on the invitation.`);
  };

  const body = (
    <>
      <div>
        <p className="text-[0.72rem] font-extrabold text-ink-2">Petals & motion</p>
        <div className="mt-2 flex rounded-full bg-ink/5 p-1 text-[0.74rem] font-bold">
          {(["off", "gentle", "lush"] as const).map((p) => (
            <button key={p} disabled={!unlocked} onClick={() => { setCfg({ motion: { ...motion, petals: p } }); if (p !== "off") playChime("place"); }}
              className={`flex-1 rounded-full py-2 capitalize transition disabled:cursor-not-allowed ${motion.petals === p ? "bg-white text-ink shadow-sm" : "text-ink-mute hover:text-ink"}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {([[ "shimmer", "Shimmering gold"], ["type", "Animated type"]] as const).map(([key, label]) => (
            <button key={key} disabled={!unlocked} onClick={() => setCfg({ motion: { ...motion, [key]: !motion[key] } })} aria-pressed={motion[key]}
              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-[0.74rem] font-bold transition disabled:cursor-not-allowed ${motion[key] ? "border-gold/50 bg-gold-soft/50 text-ink" : "border-ink/12 text-ink-mute"}`}>
              {label}
              <span className={`h-2 w-2 rounded-full ${motion[key] ? "bg-gold" : "bg-ink/20"}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[0.72rem] font-extrabold text-ink-2">Background music</p>
        <div className="mt-2 space-y-2">
          {MUSIC_TRACKS.map((t) => (
            <button key={t.id} disabled={!unlocked} onClick={() => { setCfg({ music: { ...music, track: t.id } }); playChime("place"); }}
              className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition disabled:cursor-not-allowed ${music.track === t.id ? "border-gold/60 bg-gold-soft/50" : "border-ink/12 hover:border-ink/30"}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${music.track === t.id ? "bg-gold text-ink" : "bg-ink/6 text-ink-mute"}`}><Music size={13} /></span>
              <span className="flex-1">
                <span className="block text-[0.8rem] font-extrabold text-ink">{t.name}</span>
                <span className="text-[0.66rem] font-semibold text-ink-mute">{t.mood}</span>
              </span>
              {music.track === t.id && <Check size={13} strokeWidth={3.4} className="text-gold-deep" />}
            </button>
          ))}
          <button disabled={!unlocked} onClick={() => fileRef.current?.click()}
            className={`flex w-full items-center gap-3 rounded-xl border border-dashed px-3.5 py-2.5 text-left transition disabled:cursor-not-allowed ${music.track === "upload" ? "border-gold/60 bg-gold-soft/50" : "border-ink/20 hover:border-gold/60"}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush-soft text-blush-deep"><UploadCloud size={13} /></span>
            <span className="flex-1">
              <span className="block text-[0.8rem] font-extrabold text-ink">{music.track === "upload" && music.uploadName ? `“${music.uploadName}”` : "Upload your song"}</span>
              <span className="text-[0.66rem] font-semibold text-ink-mute">your first dance track, under 2.5 MB</span>
            </span>
          </button>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" aria-label="Upload music track"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadTrack(f); e.target.value = ""; }} />
        </div>
      </div>
    </>
  );

  return (
    <section className={`relative overflow-hidden rounded-[1.6rem] border p-6 backdrop-blur-md ${unlocked ? "border-gold/40 bg-gradient-to-br from-gold-soft/40 to-white/60" : "border-white/70 bg-white/60"}`}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-gold-deep">
          <Crown size={12} /> Luxe studio
        </h3>
        {unlocked ? <Pill tone="gold">unlocked</Pill> : <Pill tone="pending"><Lock size={9} /> Luxe</Pill>}
      </div>
      <div className={`mt-4 ${unlocked ? "" : "pointer-events-none opacity-55"}`}>{body}</div>
      {!unlocked && (
        <div className="mt-4 rounded-2xl bg-ink p-4 text-cream">
          <p className="text-[0.8rem] font-bold leading-snug">Motion, petals and music are the Luxe difference — animated invitations guests actually gasp at.</p>
          <button onClick={() => openCheckout("luxe")} className="mt-3 w-full rounded-full bg-gold py-2.5 text-[0.8rem] font-extrabold text-ink transition hover:brightness-110 cursor-pointer">
            Unlock with Premium Luxe · $199
          </button>
        </div>
      )}
      {unlocked && (
        <p className="mt-4 text-[0.68rem] font-semibold text-ink-mute">Heard in Live preview and on your guest page{db.plan === "luxe" ? "" : ""}.</p>
      )}
    </section>
  );
}

/* ------------------------------ import designs ------------------------------ */

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1400;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const c = canvas.getContext("2d");
      if (!c) { URL.revokeObjectURL(url); reject(new Error("no canvas")); return; }
      c.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

function ImportDesignsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, patch, toast } = useApp();
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const importFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.html?$/i.test(f.name) || f.type.includes("html"));
    if (!list.length) { toast("HTML or images only", "Complete .html invitations, or PNG/JPG exports from Canva, Figma, Photoshop…", "warn"); return; }
    setBusy(true);
    let used = db.customTemplates.reduce((s, c) => s + (c.dataUrl?.length ?? c.html?.length ?? 0), 0);
    const added: typeof db.customTemplates = [];
    let skipped = 0;
    for (const f of list) {
      if (used > 4 * 1024 * 1024) { toast("Storage is getting full", "Browser storage caps the collection around 4 MB — remove an old design to add more.", "warn"); break; }
      const pretty = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()) || "My design";
      const isHtml = /\.html?$/i.test(f.name) || f.type.includes("html");
      try {
        if (isHtml) {
          const text = await f.text();
          if (!/<[\s\S]*>/i.test(text)) { skipped++; continue; }
          const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
          used += text.length;
          added.push({ id: `ct-${Date.now()}-${added.length}`, name: (title || pretty).slice(0, 42), dataUrl: null, html: text, addedAt: Date.now() });
        } else {
          const dataUrl = await compressImage(f);
          used += dataUrl.length;
          added.push({ id: `ct-${Date.now()}-${added.length}`, name: pretty, dataUrl, html: null, addedAt: Date.now() });
        }
      } catch { toast(`Couldn't read ${f.name}`, undefined, "warn"); }
    }
    if (added.length) {
      patch({ customTemplates: [...added, ...db.customTemplates] });
      playChime("sparkle");
      const liveCount = added.filter((a) => a.html).length;
      toast(
        added.length === 1 ? `“${added[0].name}” joined the Luxe collection` : `${added.length} designs joined the Luxe collection`,
        liveCount
          ? `${liveCount} live HTML invitation${liveCount > 1 ? "s" : ""} — interactive everywhere, crown-gated until Luxe.`
          : "Crown-gated in the gallery — couples on Luxe unlock them.",
      );
    }
    if (skipped) toast(`${skipped} file${skipped > 1 ? "s" : ""} skipped`, "Didn't look like a valid HTML document.", "warn");
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} label="Add designs to the Luxe bundle">
      <div className="p-7 sm:p-8">
        <p className="flex items-center gap-2 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-gold-deep">
          <Crown size={13} /> Site owner · Luxe curation
        </p>
        <h2 className="mt-2 font-display text-[1.7rem] text-ink">Bundle your designs with Premium Luxe</h2>
        <p className="mt-2 text-[0.85rem] leading-relaxed text-ink-2">
          Add your own invitations to the <strong className="text-ink">Luxe collection</strong> — the premium originals
          couples unlock with the $199 tier. Drop in <strong className="text-ink">complete HTML invitations</strong> (they
          run live and interactive, exactly as you built them) or flat PNG/JPG artwork. Everything appears crown-gated:
          free to preview, locked until Luxe. RSVPs, meals and notes still collect on the guest page beneath each design.
        </p>

        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void importFiles(e.dataTransfer.files); }}
          className={`mt-5 flex w-full cursor-pointer flex-col items-center gap-3 rounded-[1.4rem] border-2 border-dashed px-6 py-10 text-center transition-all duration-300 ${dragOver ? "border-gold bg-gold-soft/50 scale-[1.01]" : "border-ink/20 bg-white/60 hover:border-gold/60 hover:bg-gold-soft/25"}`}
        >
          <span className={`flex h-14 w-14 items-center justify-center rounded-full transition ${dragOver ? "bg-gold text-ink" : "bg-blush-soft text-blush-deep"}`}>
            <UploadCloud size={22} />
          </span>
          <span className="text-[0.95rem] font-extrabold text-ink">{busy ? "Reading & bundling…" : dragOver ? "Let go — they're in good hands" : "Drag invitations here, or tap to browse"}</span>
          <span className="text-[0.72rem] font-semibold text-ink-mute">HTML · PNG · JPG — self-contained HTML runs live (inline CSS/JS; CDN fonts & linked images fine)</span>
        </button>
        <input ref={inputRef} type="file" accept=".html,.htm,image/*" multiple className="hidden" aria-label="Choose invitation files"
          onChange={(e) => { if (e.target.files?.length) void importFiles(e.target.files); e.target.value = ""; }} />

        {db.customTemplates.length > 0 && (
          <p className="mt-4 text-center text-[0.76rem] font-bold text-ink-2">
            {db.customTemplates.length} design{db.customTemplates.length > 1 ? "s" : ""} imported — manage them in “My designs”.
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className={btn.ink}>Done</button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ custom hero (live preview) ------------------------------ */

function CustomHero({ custom, colors, countdown, reduced }: {
  custom: CustomTemplate;
  colors: { bg: string; ink: string; accent: string };
  countdown: { d: number; h: number; m: number; s: number };
  reduced: boolean;
}) {
  if (custom.html) {
    return (
      <div>
        <motion.div initial={reduced ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
          <DesignFrame html={custom.html} title={`${custom.name} — live invitation`} className="h-[58vh] min-h-[420px] bg-white" />
        </motion.div>
        <div className="flex items-center justify-center gap-2 px-8 py-3 text-center" style={{ background: colors.bg, color: colors.ink }}>
          <Sparkles size={12} style={{ color: colors.accent }} />
          <p className="text-[0.72rem] font-bold tracking-wide opacity-75">A live, interactive invitation — explore it above</p>
        </div>
        <div className="flex justify-center px-8 py-8" style={{ background: colors.bg, color: colors.ink }}>
          <motion.div initial={reduced ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="flex gap-3 sm:gap-5" aria-label="Countdown to the wedding">
            {[["days", countdown.d], ["hrs", countdown.h], ["min", countdown.m], ["sec", countdown.s]].map(([label, v]) => (
              <div key={label as string} className="w-16 rounded-2xl border px-2 py-3 text-center sm:w-20" style={{ borderColor: `${colors.accent}55`, background: `${colors.accent}0F` }}>
                <p className="font-display text-2xl tabular-nums sm:text-3xl">{String(v).padStart(2, "0")}</p>
                <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.2em] opacity-60">{label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <motion.div initial={reduced ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
        <img src={custom.dataUrl ?? ""} alt={`${custom.name} — invitation design`} className="w-full" />
      </motion.div>
      <div className="flex justify-center px-8 py-10" style={{ background: colors.bg, color: colors.ink }}>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}
          className="flex gap-3 sm:gap-5" aria-label="Countdown to the wedding"
        >
          {[["days", countdown.d], ["hrs", countdown.h], ["min", countdown.m], ["sec", countdown.s]].map(([label, v]) => (
            <div key={label as string} className="w-16 rounded-2xl border px-2 py-3 text-center sm:w-20" style={{ borderColor: `${colors.accent}55`, background: `${colors.accent}0F` }}>
              <p className="font-display text-2xl tabular-nums sm:text-3xl">{String(v).padStart(2, "0")}</p>
              <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.2em] opacity-60">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
