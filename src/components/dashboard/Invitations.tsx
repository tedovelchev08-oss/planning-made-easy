import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check, Copy, ExternalLink, Heart, Instagram, Link2, Loader2, Lock, Mail, MessageCircle, Monitor,
  Music, Play, Send, Smartphone, Sparkles, StopCircle, Tablet, Trash2, UploadCloud, X,
} from "lucide-react";
import { Guest, MEALS, MUSIC_TRACKS, RsvpEntry, TEMPLATE_CATS, Template, bestGuestMatch, fmtDate, seedTemplates, timeAgo } from "../../lib/data";
import { IMAGES } from "../../lib/images";
import { useApp, usePrefersReducedMotion } from "../../lib/store";
import { FEATURES, FREE_DESIGN_ID, PLANS, can, formatPrice, guestLimit, type Feature } from "../../lib/plans";
import { useCurrency } from "../../lib/currency";
import { guestLink } from "../../lib/links";
import { MUSIC_TYPES, deleteMusic, deletePhoto, isUploadedPhoto, musicFileProblem, uploadMusic } from "../../lib/api";
import { PhotoUpload } from "./PhotoUpload";
import { Lining, Panel } from "./Panel";
import { playChime, useChimeLoop } from "../../lib/sound";
import { DesignFrame, Field, Modal, Pill, PlanTag, SafeImg, inputCls } from "../ui";
import type { CustomTemplate } from "../../lib/data";
import { STUDIO_DESIGNS, studioDesignOf, tracksOf } from "../../../api/_lib/studioDesigns";
import { StudioDetails, StudioGallery, StudioPreviewPane, openStudioPreview, writePreview } from "./StudioDesigns";

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
  const hasUpload = musicCfg.track === "upload" && !!musicCfg.uploadUrl;
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
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}
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
              MADE WITH TWOFOLD · {db.website.domain.toUpperCase()}
            </p>
          </div>
        </div>
      </div>
      {hasUpload && <audio ref={audioRef} src={musicCfg.uploadUrl ?? undefined} loop onEnded={() => setUploadPlaying(false)} className="hidden" />}
    </motion.div>
  );
}

/* ------------------------------ main module ------------------------------ */

export default function Invitations() {
  const { db, patch, toast, openUpgrade, mode, weddingId } = useApp();
  const [cat, setCat] = useState<string>("all");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [live, setLive] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const reduced = usePrefersReducedMotion();

  const cfg = db.invitation;
  const activeCustom = db.customTemplates.find((c) => c.id === cfg.templateId) ?? null;
  const isHtmlDesign = !!activeCustom?.html;
  /** one of the owner's own designs (Block 18): a page of its own, previewed in its own tab */
  const studio = studioDesignOf(cfg.templateId);

  // an open preview tab follows the couple's edits (luma-bridge.js reloads on change)
  useEffect(() => { if (studio) writePreview(db, studio); }, [studio, db]);
  const template = seedTemplates.find((t) => t.id === cfg.templateId) ?? seedTemplates[0];
  const colors = resolveColors(template, cfg.colors);
  const serif = cfg.fontSerif ?? template.serif;
  const isLuxeTemplate = !!template.luxe;
  const luxeUnlocked = can(db.plan, "premiumDesigns");
  const animated = isLuxeTemplate && luxeUnlocked;
  /** whether a design can be chosen on this plan */
  const designLocked = (t: Template) =>
    t.luxe ? !can(db.plan, "premiumDesigns") : t.id !== FREE_DESIGN_ID && !can(db.plan, "allDesigns");

  const setCfg = (p: Partial<typeof cfg>) => patch({ invitation: { ...cfg, ...p } });
  /** a change only paid plans make: applies it, or explains the upgrade */
  const setPaid = (feature: Feature, p: Partial<typeof cfg>) => (can(db.plan, feature) ? setCfg(p) : openUpgrade(feature));

  const templates = useMemo(() => seedTemplates.filter((t) => cat === "all" || t.cat === cat), [cat]);

  const choose = (t: Template) => {
    if (designLocked(t)) {
      openUpgrade(t.luxe ? "premiumDesigns" : "allDesigns");
      return;
    }
    // an uploaded photo is kept across designs (its file would otherwise be orphaned)
    const own = isUploadedPhoto(cfg.photo) ? cfg.photo : null;
    setCfg({ templateId: t.id, colors: null, fontSerif: null, photo: t.photo ? cfg.photo ?? t.photo : own });
    toast(`Template — ${t.name}`, "Make it yours on the right.");
  };


  return (
    <div className="space-y-6">
      {isLuxeTemplate && !luxeUnlocked && (
        <div role="note" className="pl-card flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 shadow-[inset_3px_0_0_var(--pl-gold),0_18px_40px_-30px_rgb(60_40_15/.55)]">
          <Lock size={15} strokeWidth={1.6} className="shrink-0 text-[var(--pl-bronze)]" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[14.5px]">This {PLANS.luxe.name} design shows still here. With {PLANS.luxe.name}, its petals, shimmer and motion play for your guests.</p>
          <button onClick={() => openUpgrade("premiumDesigns")} className="pl-quiet">See {PLANS.luxe.name}</button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* preview */}
        <section className="pl-card min-w-0 self-start" aria-label="Preview">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--pl-line)] px-5 pb-3.5 pt-5 sm:px-6">
            <h2 className="min-w-0 font-display text-[26px] leading-none">
              <Lining text={studio ? studio.name : activeCustom ? activeCustom.name : template.name} />{" "}
              <span className="font-accent text-[18px] italic text-[var(--pl-bronze)]">{studio ? "a studio design" : activeCustom ? "your own design" : template.cat}</span>
            </h2>
            {!studio && (
              <div className="pl-seg" role="group" aria-label="Preview size">
                {([["desktop", Monitor, "Laptop"], ["tablet", Tablet, "Tablet"], ["mobile", Smartphone, "Phone"]] as const).map(([d, Icon, name]) => (
                  <button key={d} onClick={() => setDevice(d)} aria-pressed={device === d} aria-label={`${name} preview`} className="!px-3">
                    <Icon size={15} strokeWidth={1.6} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[rgb(28_26_23/.035)] px-3 py-5 sm:px-6 sm:py-6">
            <div className={`mx-auto max-h-[600px] overflow-y-auto rounded-[3px] shadow-[0_24px_50px_-28px_rgb(0_0_0/.5)] ring-1 ring-[var(--pl-line)] transition-[max-width] duration-500 ${device === "mobile" ? "max-w-[340px]" : device === "tablet" ? "max-w-[560px]" : "max-w-full"}`}>
              {studio ? (
                <StudioPreviewPane design={studio} />
              ) : activeCustom ? (
                activeCustom.html ? (
                  <DesignFrame html={activeCustom.html} title={`${activeCustom.name}, your invitation`} className="h-[540px] bg-white" />
                ) : (
                  <img src={activeCustom.dataUrl ?? ""} alt={`${activeCustom.name}, your invitation design`} className="w-full" />
                )
              ) : (
                <InviteArt key={template.id + device} template={template} colors={colors} serif={serif} cfg={cfg} animated={animated && !reduced} dateIso={db.wedding.date} />
              )}
            </div>
            {activeCustom && (
              <p className="mx-auto mt-4 max-w-xl text-center text-[13px] text-[var(--pl-ink-2)]">
                {activeCustom.html ? "Your own design runs exactly as you built it." : "Your artwork is the invitation."} The reply form, meals and notes sit beneath it on the guest page.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--pl-line)] px-5 py-4 sm:px-6">
            <button onClick={() => (studio ? openStudioPreview(db, studio) : setLive(true))} className="pl-act"><Play size={14} strokeWidth={1.8} /> Preview as a guest</button>
            <a href="#/invite" target="_blank" rel="noreferrer" className="pl-quiet"><ExternalLink size={14} strokeWidth={1.6} /> Open the guest page</a>
            {animated && <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-[var(--pl-ink-2)]"><Sparkles size={13} strokeWidth={1.6} className="text-[var(--pl-bronze)]" /> Animated for guests</span>}
          </div>
        </section>

        {/* controls */}
        <div className="min-w-0 space-y-5">
          {studio ? (
            <StudioDetails cfg={cfg} setCfg={setCfg} design={studio} />
          ) : isHtmlDesign ? (
            <Panel title="Your own design">
              <p className="text-[14px] leading-relaxed text-[var(--pl-ink-2)]">
                It brings its own look, wording and movement, so there is nothing to restyle here. The reply options, music and motion below still apply on the guest page.
              </p>
            </Panel>
          ) : (
          <>
          <Panel title="Wording">
            <div className="space-y-3.5">
              <Field label="Names"><input className={inputCls} value={cfg.names} onChange={(e) => setCfg({ names: e.target.value })} /></Field>
              <Field label="Opening line"><input className={inputCls} value={cfg.line1} onChange={(e) => setCfg({ line1: e.target.value })} /></Field>
              <Field label="Invitation line"><input className={inputCls} value={cfg.line2} onChange={(e) => setCfg({ line2: e.target.value })} /></Field>
              <Field label="Venue line"><input className={inputCls} value={cfg.venueLine} onChange={(e) => setCfg({ venueLine: e.target.value })} /></Field>
            </div>
          </Panel>

          <Panel title="Colours and type" aside={!can(db.plan, "customize") ? <PlanTag plan="celebration" /> : undefined}>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setPaid("customize", { colors: null })} aria-label="The design's own colours" aria-pressed={cfg.colors === null}
                className={`h-9 w-9 rounded-full transition cursor-pointer ${cfg.colors === null ? "ring-2 ring-[var(--pl-bronze)] ring-offset-2 ring-offset-[var(--pl-card)]" : "ring-1 ring-[var(--pl-line)] hover:ring-[rgb(28_26_23/.35)]"}`}
                style={{ background: `linear-gradient(135deg, ${template.bg} 50%, ${template.accent} 50%)` }} />
              {PALETTES.map((p) => {
                const on = !!cfg.colors && cfg.colors.bg === p.bg && cfg.colors.accent === p.accent;
                return (
                  <button key={p.name} onClick={() => setPaid("customize", { colors: p })} aria-label={`${p.name} colours`} aria-pressed={on} title={p.name}
                    className={`h-9 w-9 rounded-full transition cursor-pointer ${on ? "ring-2 ring-[var(--pl-bronze)] ring-offset-2 ring-offset-[var(--pl-card)]" : "ring-1 ring-[var(--pl-line)] hover:ring-[rgb(28_26_23/.35)]"}`}
                    style={{ background: `linear-gradient(135deg, ${p.bg} 45%, ${p.accent} 45%)` }} />
                );
              })}
            </div>
            <div className="pl-seg mt-5 flex w-full" role="group" aria-label="Lettering">
              <button onClick={() => setPaid("customize", { fontSerif: true })} aria-pressed={serif} className="flex-1">Classic serif</button>
              <button onClick={() => setPaid("customize", { fontSerif: false })} aria-pressed={!serif} className="flex-1">Modern sans</button>
            </div>
          </Panel>
          </>
          )}

          <Panel title="Replies">
            <div className="-my-1.5">
              {/* studio designs ask for names, party size and notes in their own form */}
              {(studio ? [["rsvp", "Reply form"]] as const : [["rsvp", "Reply button"], ["meal", "Meal choice"], ["notes", "A note to you"]] as const).map(([key, label]) => {
                // what guests will actually see: meal and notes need Celebration
                const paid = key !== "rsvp";
                const on = cfg[key] && (!paid || can(db.plan, "rsvpDetails"));
                return (
                  <button key={key}
                    onClick={() => (paid ? setPaid("rsvpDetails", { [key]: !on } as Partial<typeof cfg>) : setCfg({ rsvp: !cfg.rsvp }))}
                    aria-pressed={on}
                    className="pl-row flex min-h-[48px] w-full items-center justify-between gap-3 py-2 text-left text-[14.5px] cursor-pointer">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">{label} {paid && !can(db.plan, "rsvpDetails") && <PlanTag plan="celebration" />}</span>
                    <span className="pl-switch" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* a studio design without music (no player) has no song to upload either */}
          {(!studio || tracksOf(studio).length > 0) && <LuxeStudio cfg={cfg} setCfg={setCfg} unlocked={luxeUnlocked} songOnly={!!studio} />}

          {!studio && template.photo && (
            <Panel title="Photo" aside={!can(db.plan, "customize") ? <PlanTag plan="celebration" /> : undefined}>
              <div className="grid grid-cols-3 gap-2">
                {PHOTO_CHOICES.map((p) => (
                  <button key={p.label} onClick={() => {
                    if (!can(db.plan, "customize")) { openUpgrade("customize"); return; }
                    // a built-in photo replaces an uploaded one, whose file is then removed
                    if (isUploadedPhoto(cfg.photo) && mode === "cloud" && weddingId) void deletePhoto(weddingId, cfg.photo).catch(() => {});
                    setCfg({ photo: p.src });
                  }} aria-label={`Use ${p.label}`} aria-pressed={cfg.photo === p.src} title={p.label}
                    className={`overflow-hidden rounded-[2px] transition cursor-pointer ${cfg.photo === p.src ? "ring-2 ring-[var(--pl-gold)] ring-offset-2 ring-offset-[var(--pl-card)]" : "opacity-85 hover:opacity-100"}`}>
                    <img src={p.src} alt="" className="h-14 w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
              <div className="mt-4">
                {can(db.plan, "customize")
                  ? <PhotoUpload photo={cfg.photo} onChange={(photo) => setCfg({ photo: photo ?? template.photo ?? null })} />
                  : <button onClick={() => openUpgrade("customize")} className="pl-link">Use your own photo</button>}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* the designs */}
      <section aria-label="Invitation designs" className="space-y-5 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[32px] leading-none">Designs</h2>
            <p className="mt-2 text-[14px] text-[var(--pl-ink-2)]"><span className="tabular-nums">{seedTemplates.length + STUDIO_DESIGNS.length + db.customTemplates.length}</span> to choose from. Pick one and it becomes your invitation.</p>
          </div>
          <button onClick={() => (can(db.plan, "customDesigns") ? setImportOpen(true) : openUpgrade("customDesigns"))} className="pl-quiet">
            <UploadCloud size={14} strokeWidth={1.6} /> Use your own design
          </button>
        </div>

        <StudioGallery cfg={cfg} setCfg={setCfg} />

        {db.customTemplates.length > 0 && (
          <div>
            <h3 className="font-display text-[22px] leading-none">Your own designs</h3>
            <p className="mt-1.5 text-[13px] text-[var(--pl-ink-2)]">Part of {PLANS[FEATURES.customDesigns.plan].name}{!can(db.plan, "customDesigns") && ", which your plan doesn't include yet"}.</p>
            <div className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:px-0">
              {db.customTemplates.map((c) => {
                const active = c.id === cfg.templateId;
                const locked = !can(db.plan, "customDesigns");
                return (
                  <div key={c.id} className={`group relative w-36 shrink-0 overflow-hidden rounded-[3px] bg-[var(--pl-card)] shadow-[0_14px_30px_-24px_rgb(60_40_15/.6)] transition ${active ? "ring-2 ring-[var(--pl-gold)] ring-offset-2 ring-offset-[var(--pl-paper)]" : "ring-1 ring-[var(--pl-line)]"}`}>
                    <button
                      onClick={() => {
                        if (locked) { openUpgrade("customDesigns"); return; }
                        setCfg({ templateId: c.id, colors: null, fontSerif: null });
                        playChime("place");
                        toast(`Design: ${c.name}`, "Your own design is now your invitation.");
                      }}
                      aria-pressed={active}
                      className="block w-full text-left cursor-pointer"
                    >
                      <span className="relative block">
                        {c.html ? (
                          <div className={`aspect-[4/5] w-full ${locked ? "opacity-80 saturate-[0.55]" : ""}`}>
                            <DesignFrame html={c.html} title={`${c.name} preview`} interactive={false} thumbWidth={144} thumbHeight={180} />
                          </div>
                        ) : (
                          <img src={c.dataUrl ?? ""} alt="" className={`aspect-[4/5] w-full object-cover ${locked ? "opacity-80 saturate-[0.55]" : ""}`} />
                        )}
                        {locked && (
                          <span className="absolute inset-0 flex items-center justify-center bg-[rgb(15_14_13/.25)]">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pl-card)] text-[var(--pl-bronze)]"><Lock size={13} strokeWidth={1.8} /></span>
                          </span>
                        )}
                      </span>
                      <span className="flex items-center justify-between gap-2 px-2.5 py-2">
                        <span className="truncate text-[13px]">{c.name}</span>
                        {active && <Check size={13} strokeWidth={2} className="shrink-0 text-[var(--pl-bronze)]" aria-label="Chosen" />}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        const remaining = db.customTemplates.filter((x) => x.id !== c.id);
                        patch({ customTemplates: remaining, invitation: cfg.templateId === c.id ? { ...cfg, templateId: seedTemplates[0].id } : cfg });
                        toast(`${c.name} removed`, undefined, "info");
                      }}
                      aria-label={`Remove ${c.name}`}
                      className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(15_14_13/.8)] text-[var(--pl-ivory)] opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:bg-[#a53d28] cursor-pointer"
                    >
                      <Trash2 size={13} strokeWidth={1.6} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="font-display text-[22px] leading-none">Classic designs</h3>
          </div>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Show designs">
            {["all", ...TEMPLATE_CATS].map((c) => (
              <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
                className={`h-10 shrink-0 rounded-full px-4 text-[13.5px] capitalize transition cursor-pointer ${cat === c ? "bg-[var(--pl-onyx)] text-[var(--pl-ivory)]" : "border border-[var(--pl-line)] bg-[var(--pl-card)] hover:border-[rgb(28_26_23/.3)]"}`}>
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>

          <div className="no-scrollbar -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 xl:grid-cols-6">
            {templates.map((t) => {
              const c = resolveColors(t, null);
              const active = t.id === cfg.templateId;
              const locked = designLocked(t);
              return (
                <button
                  key={t.id}
                  onClick={() => choose(t)}
                  aria-pressed={active}
                  className={`group relative w-36 shrink-0 overflow-hidden rounded-[3px] bg-[var(--pl-card)] text-left shadow-[0_14px_30px_-24px_rgb(60_40_15/.6)] transition sm:w-auto cursor-pointer ${active ? "ring-2 ring-[var(--pl-gold)] ring-offset-2 ring-offset-[var(--pl-paper)]" : "ring-1 ring-[var(--pl-line)] hover:ring-[rgb(28_26_23/.3)]"}`}
                >
                  <div className="aspect-[4/5] w-full overflow-hidden" style={{ background: c.bg, color: c.ink }}>
                    {t.photo ? (
                      <img src={t.photo} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" loading="lazy" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center">
                        <span className="h-6 w-10 rounded-t-full border-t-2" style={{ borderColor: c.accent }} aria-hidden="true" />
                        <span className="text-lg leading-tight" style={{ fontFamily: t.serif ? "'Playfair Display', serif" : "'Nunito Sans', sans-serif", fontWeight: t.serif ? 600 : 800 }}>M <em style={{ color: c.accent }}>&</em> T</span>
                        <span className="text-[0.5rem] uppercase tracking-[0.3em]" style={{ color: c.accent }}>Save the date</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <span className="truncate text-[13px]">{t.name}</span>
                    {active ? (
                      <Check size={13} strokeWidth={2} className="shrink-0 text-[var(--pl-bronze)]" aria-label="Chosen" />
                    ) : locked ? (
                      <span className="flex shrink-0 items-center text-[var(--pl-bronze)]"><Lock size={12} strokeWidth={1.8} aria-hidden="true" /><span className="sr-only">{t.luxe ? PLANS.luxe.name : PLANS.celebration.name}</span></span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <ImportDesignsModal open={importOpen} onClose={() => setImportOpen(false)} />
      <AnimatePresence>{live && <LivePreview onClose={() => setLive(false)} />}</AnimatePresence>
    </div>
  );
}


/* ------------------------------ share link card ------------------------------ */

export function ShareCard() {
  const { db, patch, toast, openUpgrade } = useApp();
  const shareKit = can(db.plan, "shareKit");
  const [copied, setCopied] = useState(false);
  // cloud links carry the real slug so any device lands on this couple's page;
  // demo has no slug, so its link opens the local sample guest page
  const slug = db.wedding.slug;
  const link = guestLink({ slug });
  const dateStr = fmtDate(db.wedding.date, { month: "long", day: "numeric", year: "numeric" });
  const messageFor = (src: string) =>
    `${db.wedding.names} are getting married — ${dateStr} at ${db.wedding.venue}. RSVP in one tap: ${guestLink({ slug, src })}`;
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
    { label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(messageFor("whatsapp"))}` },
    { label: "Instagram", icon: Instagram, href: "https://www.instagram.com/", copyFirst: true },
    { label: "Messenger", icon: Send, href: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(guestLink({ slug, src: "messenger" }))}&app_id=140586622674265&redirect_uri=${encodeURIComponent(link)}` },
    { label: "Text", icon: MessageCircle, href: `sms:?&body=${encodeURIComponent(messageFor("link"))}` },
    { label: "Email", icon: Mail, href: `mailto:?subject=${encodeURIComponent(`${db.wedding.names} — you're invited ♥`)}&body=${encodeURIComponent(messageFor("email"))}` },
  ];

  const open = db.invitation.live;
  const toggleOpen = () => {
    patch({ invitation: { ...db.invitation, live: !open } });
    toast(open ? "Invitation closed" : "Open to guests",
      open ? "Anyone opening your link now sees that it isn't open yet." : "Anyone with your link can see it and reply.");
  };

  return (
    <section aria-label="Share your invitation" className="pl-share relative overflow-hidden rounded-[3px] bg-[var(--pl-onyx)] text-[var(--pl-ivory)] shadow-[0_24px_50px_-30px_rgb(0_0_0/.6)]">
      <div className="relative grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
        <div className="min-w-0">
          <h2 className="font-display text-[28px] leading-[1.05] sm:text-[34px]">The link your guests open</h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[rgb(237_227_207/.72)]">
            Your invitation and its reply form, at one address. Send it however you talk to people; every answer lands in Replies.
          </p>
          {/* 0011: an invitation is closed until the couple opens it, so a
              guessed address shows nothing of a wedding not yet shared */}
          <button type="button" role="switch" aria-checked={open} onClick={toggleOpen}
            className="mt-6 flex w-full max-w-md items-center gap-4 rounded-[2px] border border-[rgb(237_227_207/.16)] px-4 py-3.5 text-left transition hover:border-[rgb(237_227_207/.32)] cursor-pointer">
            <span className="pl-switch on-dark" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-[15px]">Open to guests</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-[rgb(237_227_207/.62)]">
                {open ? "Anyone with the link sees your invitation and can reply." : "Off. Guests with the link see “not open yet”; your names, date and venue stay private."}
              </span>
            </span>
          </button>
        </div>

        <div className="min-w-0 self-end">
          <div className="flex items-center gap-2 rounded-[2px] border border-[rgb(237_227_207/.2)] bg-[rgb(237_227_207/.05)] p-1.5 pl-3.5">
            <Link2 size={14} strokeWidth={1.6} className="shrink-0 text-[var(--pl-gold)]" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-[14px] text-[rgb(237_227_207/.9)]" title={link}>{link.replace(/^https?:\/\//, "")}</span>
            <button onClick={copy}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[2px] bg-[var(--pl-gold)] px-4 text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--pl-onyx)] transition hover:bg-[#d8b97c] cursor-pointer">
              {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.8} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {channels.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                onClick={(e) => {
                  // the copy-link button stays free; channel sharing is the share kit
                  if (!shareKit) { e.preventDefault(); openUpgrade("shareKit"); return; }
                  if (c.copyFirst) copy();
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[rgb(237_227_207/.2)] px-3.5 text-[13px] text-[rgb(237_227_207/.85)] transition hover:border-[rgb(237_227_207/.45)] hover:text-[var(--pl-ivory)]"
              >
                <c.icon size={14} strokeWidth={1.6} /> {c.label}
              </a>
            ))}
            {!shareKit && <span className="inline-flex h-10 items-center gap-1 px-1 text-[12.5px] text-[var(--pl-gold)]"><Lock size={11} strokeWidth={1.8} aria-hidden="true" /> {PLANS.celebration.name}</span>}
          </div>
          <button onClick={nativeShare} className="mt-3 text-[13.5px] text-[rgb(237_227_207/.75)] underline underline-offset-4 transition hover:text-[var(--pl-ivory)] cursor-pointer">
            Or use your phone's share sheet
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ RSVP tracker ------------------------------ */

const SOURCE_META: Record<string, { icon: typeof Link2; label: string }> = {
  link: { icon: Link2, label: "Link" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
  instagram: { icon: Instagram, label: "Instagram" },
  messenger: { icon: Send, label: "Messenger" },
  email: { icon: Mail, label: "Email" },
};

/** Copies a guest's personal invite link — their name arrives pre-filled. */
function PersonalLinkButton({ guest, token }: { guest: string; token: string }) {
  const { toast, db, openUpgrade } = useApp();
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        if (!can(db.plan, "personalLinks")) { openUpgrade("personalLinks"); return; }
        const url = guestLink({ token });
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
      className="pl-quiet !h-9 shrink-0"
    >
      {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.6} />} {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export function RsvpTracker() {
  const { db, patch, toast, openUpgrade, booting } = useApp();
  /** an RSVP that would push the list past the plan's guest limit waits, unsynced */
  const fits = (next: Guest[]) => {
    if (next.length <= db.guests.length || next.length <= guestLimit(db.plan)) return true;
    openUpgrade("unlimitedGuests");
    return false;
  };
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
    const next = buildSync(db.guests, entry, host);
    if (!fits(next)) return;
    patch({
      guests: next,
      rsvpLog: db.rsvpLog.map((e) => (e.id === entryId ? { ...e, synced: true } : e)),
    });
    playChime("done");
    const po = entry.answer === "yes" && entry.plusOne?.trim() ? ` + ${entry.plusOne.trim()}` : "";
    toast(`${entry.name}${po} counted`, "Their answer is in your guest list.");
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
    if (!fits(guests)) return;
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
      toast("Nothing to add on its own", "These need a quick look: a name that's close to a guest's, or someone new.", "info");
      return;
    }
    if (!fits(guests)) return;
    patch({ guests, rsvpLog: db.rsvpLog.map((e) => (syncedIds.includes(e.id) ? { ...e, synced: true } : e)) });
    playChime("sparkle");
    toast("Added to your guest list", `${applied} ${applied === 1 ? "answer" : "answers"} counted. Any left need a quick look below.`);
  };

  /** a ready-to-paste reminder — Twofold doesn't send it, the couple does */
  const remind = async () => {
    const when = fmtDate(db.wedding.date, { month: "long", day: "numeric", year: "numeric" });
    const text = `A gentle reminder: ${db.wedding.names} would love to know if you can join them on ${when}. You can RSVP in one tap here: ${guestLink({ slug: db.wedding.slug, src: "link" })}`;
    try {
      await navigator.clipboard.writeText(text);
      toast("Reminder copied", `Paste it into your group chat, messages or email — ${waiting} ${waiting === 1 ? "guest hasn't" : "guests haven't"} replied yet.`);
    } catch {
      toast("Copy this reminder", text, "info");
    }
  };

  const total = Math.max(1, db.guests.length);
  const pendingWithToken = db.guests.filter((g) => g.rsvp === "pending" && g.token);

  return (
    <section aria-label="Replies" className="space-y-5">
      {/* while the planner loads, the list is this device's last copy: say so, not as if it were final */}
      {booting ? (
        <p role="status" className="flex items-center gap-2 text-[14px] text-[var(--pl-ink-2)]">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Checking for new answers…
        </p>
      ) : (
        <p className="text-[14px] text-[var(--pl-ink-2)]">Every answer from your link, messages and emails, as it arrives.</p>
      )}

      <div className="pl-card px-5 py-5 sm:px-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Coming", value: confirmed, dot: "bg-[#7aa06a]" },
            { label: "Waiting", value: waiting, dot: "bg-[var(--pl-gold)]" },
            { label: "Can't come", value: declined, dot: "bg-[#b55a45]" },
          ].map((s) => (
            <div key={s.label} className="min-w-0">
              <p className="text-[34px] font-light leading-none tabular-nums sm:text-[40px]">{s.value}</p>
              <p className="mt-2 flex items-center gap-2 text-[13.5px] text-[var(--pl-ink-2)]"><span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />{s.label}</p>
            </div>
          ))}
        </div>
        <div className="pl-meter" aria-hidden="true">
          <span className="bg-[#7aa06a]" style={{ width: `${(confirmed / total) * 100}%` }} />
          <span className="bg-[var(--pl-gold)]" style={{ width: `${(waiting / total) * 100}%` }} />
          <span className="bg-[#b55a45]" style={{ width: `${(declined / total) * 100}%` }} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {unsynced.length > 0 && (
            <button onClick={syncAll} className="pl-act">Add {unsynced.length} to the guest list</button>
          )}
          <button onClick={() => void remind()} disabled={waiting === 0} className="pl-quiet">
            <Copy size={14} strokeWidth={1.6} /> <span>Copy a reminder for the <span className="tabular-nums">{waiting}</span> waiting</span>
          </button>
        </div>
      </div>

      {/* per-guest personal links: the fastest way to hear from the undecided */}
      {pendingWithToken.length > 0 && (
        <section className="pl-card" aria-label="Personal links">
          <div className="pl-card-h">
            <h3>Their own links</h3>
            <small>Each one fills in the guest's name</small>
          </div>
          <ul className="grid sm:grid-cols-2">
            {pendingWithToken.slice(0, 6).map((g) => (
              <li key={g.id} className="flex items-center gap-3 border-b border-[var(--pl-line)] px-5 py-2.5 sm:px-6 sm:odd:border-r">
                <span className="min-w-0 flex-1 truncate text-[14.5px]">{g.name}</span>
                <PersonalLinkButton guest={g.name} token={g.token ?? ""} />
              </li>
            ))}
          </ul>
          {pendingWithToken.length > 6 && (
            <p className="px-5 py-3 text-[13px] text-[var(--pl-ink-2)] sm:px-6"><span className="tabular-nums">{pendingWithToken.length - 6}</span> more are waiting on their own link. Find them in Guests.</p>
          )}
        </section>
      )}

      {log.length === 0 ? (
        <div className="rounded-[3px] border border-dashed border-[rgb(28_26_23/.2)] px-8 py-14 text-center">
          <p className="font-display text-[24px]">No replies yet</p>
          <p className="mx-auto mt-2 max-w-sm text-[15px] text-[var(--pl-ink-2)]">Share your link from the invitation and the answers will arrive here.</p>
        </div>
      ) : (
        <section className="pl-card" aria-label="Every answer">
          <div className="pl-card-h">
            <h3>Every answer</h3>
            <small className="tabular-nums">{log.length}</small>
          </div>
          <ul>
            {log.map((e) => {
              const source = SOURCE_META[e.source] ?? SOURCE_META.link;
              const Icon = source.icon;
              const m = matchFor(e);
              const yes = e.answer === "yes";
              return (
                <li key={e.id} className="pl-row flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:flex-nowrap sm:px-6">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e4d6bb] text-[12px] tracking-[0.04em]" aria-hidden="true">
                    {e.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[15px]">
                      <span className="truncate">{e.name}</span>
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--pl-ink-2)]"><span className={`h-[7px] w-[7px] rounded-full ${yes ? "bg-[#7aa06a]" : "bg-[#b55a45]"}`} aria-hidden="true" />{yes ? "Coming" : "Can't come"}</span>
                      {e.meal && <span className="text-[13px] text-[var(--pl-ink-2)]">{e.meal}</span>}
                      {yes && e.plusOne && <span className="pl-who !text-[15px]">with {e.plusOne}</span>}
                    </p>
                    {e.note && <p className="mt-0.5 truncate font-accent text-[16px] italic text-[var(--pl-ink-2)]">“{e.note}”</p>}
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[var(--pl-ink-2)]"><Icon size={12} strokeWidth={1.6} aria-hidden="true" /> {source.label} · {timeAgo(e.at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {e.synced ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-[#4f7a43]"><Check size={14} strokeWidth={2} aria-hidden="true" /> In your list</span>
                    ) : m.guest && m.exact ? (
                      <button onClick={() => apply(e.id)} className="pl-quiet !h-9">Add to the list</button>
                    ) : m.guest ? (
                      <>
                        <span className="max-w-[150px] truncate text-[13px] text-[var(--pl-ink-2)]" title={`${Math.round(m.score * 100)}% like ${m.guest.name}`}>Is this {m.guest.name}?</span>
                        <button onClick={() => apply(e.id, m.guest!.id)} className="pl-quiet !h-9">Yes</button>
                        <button onClick={() => addAsNewGuest(e.id)} className="pl-link !text-[13px]">New guest</button>
                      </>
                    ) : (
                      <button onClick={() => addAsNewGuest(e.id)} className="pl-quiet !h-9">Add as a guest</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}

/* ------------------------------ luxe studio ------------------------------ */

function LuxeStudio({ cfg, setCfg, unlocked, songOnly = false }: {
  cfg: ReturnType<typeof useApp>["db"]["invitation"];
  setCfg: (p: Partial<ReturnType<typeof useApp>["db"]["invitation"]>) => void;
  unlocked: boolean;
  /** a studio design brings its own motion and tracks: only the couple's own song applies */
  songOnly?: boolean;
}) {
  const { toast, openUpgrade, mode, weddingId } = useApp();
  const [currency] = useCurrency();
  const fileRef = useRef<HTMLInputElement>(null);
  const motion = cfg.motion;
  const music = cfg.music;

  const [uploading, setUploading] = useState(false);
  const songName = (file: File) => file.name.replace(/\.[^.]+$/, "");

  /**
   * The song is stored as a file: media/<wedding>/music/<random>.<ext>. It used
   * to be held as a data URL and dropped on save (uploadUrl: null), so couples
   * heard it in preview and their guests never did.
   */
  const uploadTrack = async (file: File) => {
    const problem = musicFileProblem(file);
    if (problem) { toast("We can't use that file", problem, "warn"); return; }

    if (mode !== "cloud" || !weddingId) {
      // demo: nothing to store it in; play it here, and say it won't last
      setCfg({ music: { track: "upload", uploadName: songName(file), uploadUrl: URL.createObjectURL(file) } });
      toast("Playing in the demo", "Uploaded songs are saved for real weddings; this one lasts until you leave.", "info");
      return;
    }

    setUploading(true);
    const previous = music.uploadUrl;
    try {
      const url = await uploadMusic(weddingId, file);
      setCfg({ music: { track: "upload", uploadName: songName(file), uploadUrl: url } });
      playChime("sparkle");
      toast("Your song is in", `“${songName(file)}” will play when guests open your invitation.`);
      // the replaced song is no longer referenced anywhere: remove it
      if (previous && previous !== url) void deleteMusic(weddingId, previous).catch(() => {});
    } catch (err) {
      toast("Your song didn't upload", err instanceof Error ? err.message : "Please try again.", "warn");
    } finally {
      setUploading(false);
    }
  };

  const removeTrack = async () => {
    const previous = music.uploadUrl;
    setCfg({ music: { track: "serene", uploadName: null, uploadUrl: null } });
    toast("Song removed", songOnly ? "Your invitation plays the music you picked for it." : "Your invitation plays “Serene” again.", "info");
    if (mode === "cloud" && weddingId && previous) {
      await deleteMusic(weddingId, previous).catch(() => {
        toast("The old file is still stored", "It's no longer played. We'll try again next time.", "warn");
      });
    }
  };

  const option = (on: boolean) =>
    `flex w-full items-center gap-3 rounded-[2px] border px-3.5 py-2.5 text-left transition disabled:cursor-not-allowed cursor-pointer ${on ? "border-[var(--pl-gold)] bg-[rgb(201_168_106/.12)]" : "border-[var(--pl-line)] hover:border-[rgb(28_26_23/.3)]"}`;

  const body = (
    <>
      {!songOnly && (
      <div>
        <p className="text-[13px] text-[rgb(28_26_23/.7)]">Petals</p>
        <div className="pl-seg mt-2 flex w-full" role="group" aria-label="Petals">
          {(["off", "gentle", "lush"] as const).map((p) => (
            <button key={p} disabled={!unlocked} aria-pressed={motion.petals === p} onClick={() => { setCfg({ motion: { ...motion, petals: p } }); if (p !== "off") playChime("place"); }}
              className="flex-1 capitalize disabled:cursor-not-allowed">
              {p}
            </button>
          ))}
        </div>
        <div className="mt-2">
          {([["shimmer", "Shimmering gold"], ["type", "Animated lettering"]] as const).map(([key, label]) => (
            <button key={key} disabled={!unlocked} onClick={() => setCfg({ motion: { ...motion, [key]: !motion[key] } })} aria-pressed={motion[key]}
              className="pl-row flex min-h-[46px] w-full items-center justify-between gap-3 py-2 text-left text-[14.5px] disabled:cursor-not-allowed cursor-pointer">
              {label}
              <span className="pl-switch" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      )}

      <div className={songOnly ? "" : "mt-5"}>
        <p className="text-[13px] text-[rgb(28_26_23/.7)]">{songOnly ? "Your own song" : "Music"}</p>
        <div className="mt-2 space-y-2">
          {!songOnly && MUSIC_TRACKS.map((t) => (
            <button key={t.id} disabled={!unlocked} aria-pressed={music.track === t.id} onClick={() => { setCfg({ music: { ...music, track: t.id } }); playChime("place"); }}
              className={option(music.track === t.id)}>
              <Music size={15} strokeWidth={1.6} className={music.track === t.id ? "text-[var(--pl-bronze)]" : "text-[var(--pl-ink-2)]"} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px]">{t.name}</span>
                <span className="block font-accent text-[15px] italic text-[var(--pl-ink-2)]">{t.mood}</span>
              </span>
              {music.track === t.id && <Check size={14} strokeWidth={2} className="text-[var(--pl-bronze)]" aria-hidden="true" />}
            </button>
          ))}
          <button disabled={!unlocked || uploading} aria-busy={uploading} onClick={() => fileRef.current?.click()}
            className={`${option(music.track === "upload")} border-dashed`}>
            <UploadCloud size={15} strokeWidth={1.6} className="text-[var(--pl-bronze)]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px]">
                {uploading ? "Uploading…" : music.uploadUrl && music.uploadName ? `“${music.uploadName}”` : "Upload your song"}
              </span>
              <span className="block text-[12.5px] text-[var(--pl-ink-2)]">
                {music.uploadUrl ? "Tap to replace it" : "MP3, M4A, WAV or OGG, up to 8 MB"}
              </span>
            </span>
          </button>
          {music.uploadUrl && (
            <button disabled={!unlocked || uploading} onClick={() => void removeTrack()} className="pl-link !text-[13px] disabled:cursor-not-allowed">
              Remove this song
            </button>
          )}
          <input ref={fileRef} type="file" accept={Object.keys(MUSIC_TYPES).join(",")} className="hidden" aria-label="Upload music track"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadTrack(f); e.target.value = ""; }} />
        </div>
      </div>
    </>
  );

  return (
    <Panel title={songOnly ? "Your own song" : "Music and motion"} aside={unlocked ? undefined : <PlanTag plan="luxe" />}>
      <div className={unlocked ? "" : "pointer-events-none opacity-55"} aria-disabled={!unlocked || undefined}>{body}</div>
      {!unlocked ? (
        <div className="mt-5 border-t border-[var(--pl-line)] pt-4">
          <p className="text-[14px] leading-snug">Petals, shimmer and a song when guests open it come with {PLANS.luxe.name}.</p>
          <button onClick={() => openUpgrade("motion")} className="pl-act mt-3 w-full">
            {PLANS.luxe.name} · {formatPrice(PLANS.luxe.price, currency)} once
          </button>
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-[var(--pl-ink-2)]">Heard when you preview as a guest, and by your guests.</p>
      )}
    </Panel>
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
    if (!list.length) { toast("Only HTML, PNG or JPG files", "A complete .html page, or an image exported from Canva, Figma or Photoshop.", "warn"); return; }
    setBusy(true);
    let used = db.customTemplates.reduce((s, c) => s + (c.dataUrl?.length ?? c.html?.length ?? 0), 0);
    const added: typeof db.customTemplates = [];
    let skipped = 0;
    for (const f of list) {
      if (used > 4 * 1024 * 1024) { toast("There's no room for more", "Your own designs can take up to about 4 MB together. Remove one to add another.", "warn"); break; }
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
      toast(
        added.length === 1 ? `“${added[0].name}” added` : `${added.length} designs added`,
        "Choose it under Designs to make it your invitation.",
      );
    }
    if (skipped) toast(`${skipped} file${skipped > 1 ? "s" : ""} skipped`, "They didn't look like a complete HTML page.", "warn");
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} label="Use your own invitation design">
      <div className="p-7 sm:p-8">
        <h2 className="font-display text-[30px] leading-none">Use your own design</h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--pl-ink-2)]">
          Bring an invitation you made yourself: a complete HTML page (it runs exactly as you built it) or a PNG or JPG.
          Guests still reply beneath it, with meal choices and notes. Part of {PLANS[FEATURES.customDesigns.plan].name}.
        </p>

        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void importFiles(e.dataTransfer.files); }}
          className={`mt-6 flex w-full cursor-pointer flex-col items-center gap-2.5 rounded-[3px] border border-dashed px-6 py-10 text-center transition ${dragOver ? "border-[var(--pl-gold)] bg-[rgb(201_168_106/.14)]" : "border-[rgb(28_26_23/.25)] hover:border-[var(--pl-bronze)]"}`}
        >
          <UploadCloud size={22} strokeWidth={1.4} className="text-[var(--pl-bronze)]" aria-hidden="true" />
          <span className="text-[15px]">{busy ? "Reading your files…" : dragOver ? "Let go to add them" : "Drop your files here, or choose them"}</span>
          <span className="text-[12.5px] text-[var(--pl-ink-2)]">HTML, PNG or JPG. An HTML page should carry its own styles; fonts and images from links are fine.</span>
        </button>
        <input ref={inputRef} type="file" accept=".html,.htm,image/*" multiple className="hidden" aria-label="Choose invitation files"
          onChange={(e) => { if (e.target.files?.length) void importFiles(e.target.files); e.target.value = ""; }} />

        {db.customTemplates.length > 0 && (
          <p className="mt-4 text-center text-[13px] text-[var(--pl-ink-2)]">
            <span className="tabular-nums">{db.customTemplates.length}</span> of your own design{db.customTemplates.length > 1 ? "s" : ""} added. They're under Designs.
          </p>
        )}

        <div className="mt-7 flex justify-end">
          <button onClick={onClose} className="pl-act">Done</button>
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
