import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Heart, Loader2, Play, Sparkles, StopCircle } from "lucide-react";
import { MEALS, RsvpSource, configureFormat, fmtDate, seedTemplates } from "../lib/data";
import { inviteLink, useApp, usePrefersReducedMotion, type Db, type InvitationConfig } from "../lib/store";
import { getGuestByToken, getPublicInvitation, submitRsvp, type PublicInvitation } from "../lib/api";
import { playChime, useChimeLoop } from "../lib/sound";
import { InviteArt } from "../components/dashboard/Invitations";
import { SiteBody } from "../components/dashboard/Website";
import { DesignFrame, Logo, SafeImg } from "../components/ui";

const VALID_SOURCES: RsvpSource[] = ["link", "whatsapp", "instagram", "messenger", "email"];

/* Custom templates arrive over the wire without client-only fields. */
type PublicCustom = { id: string; name: string; dataUrl?: string | null; html?: string | null } | null;

function PageSkeleton() {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center bg-cream px-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-white/70 shadow-card">
        <Loader2 size={20} className="animate-spin text-gold-deep" />
      </span>
      <p className="mt-5 font-display text-xl italic text-ink-2">Fetching the invitation…</p>
      <div className="mt-6 w-full max-w-sm space-y-2.5" aria-hidden="true">
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-blush/30" />
        <div className="h-3 w-full animate-pulse rounded-full bg-ink/8" style={{ animationDelay: "0.15s" }} />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-ink/8" style={{ animationDelay: "0.3s" }} />
      </div>
    </div>
  );
}

function MissingInvite() {
  return (
    <div className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-cream px-6 text-center">
      <span className="inv-petal" style={{ left: "22%", animationDuration: "12s" }} aria-hidden="true" />
      <span className="inv-petal" style={{ left: "64%", animationDuration: "14s", animationDelay: "3s" }} aria-hidden="true" />
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 bg-white/70 shadow-card">
        <Heart size={22} className="text-blush-deep" />
      </span>
      <h1 className="mt-6 font-display text-4xl tracking-tight text-ink">This invitation can't be found</h1>
      <p className="mt-3 max-w-sm text-[0.92rem] leading-relaxed text-ink-2">
        The link may have lost a letter on the way, or the couple hasn't published their page yet.
        Double-check the address — or head back to Luma.
      </p>
      <Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[0.88rem] font-bold text-cream transition hover:bg-ink/85 active:scale-[0.97]">
        Back to Luma
      </Link>
    </div>
  );
}

function useCountdown(target: number) {
  const [c, setC] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setC({
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
  return c;
}

export default function GuestInvite() {
  const { db, patch, toast, mode } = useApp();
  const reduced = usePrefersReducedMotion();
  const [params] = useSearchParams();
  const token = params.get("token");
  const srcParam = params.get("src");
  const source: RsvpSource = VALID_SOURCES.includes(srcParam as RsvpSource) ? (srcParam as RsvpSource) : "link";

  /*
   * Cloud mode: the page renders from the couple's PUBLIC record, addressed by
   * slug (open link) or resolved from a per-guest token — so a guest on any
   * device sees the real invitation, not the viewer's own workspace.
   * Demo mode keeps the seeded local playground.
   */
  const [pub, setPub] = useState<PublicInvitation | null>(null);
  const [knownGuest, setKnownGuest] = useState<{ id: string; name: string } | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">(mode === "cloud" ? "loading" : "ready");

  useEffect(() => {
    if (mode !== "cloud") return;
    let live = true;
    (async () => {
      try {
        let slug = params.get("slug");
        if (token) {
          const g = await getGuestByToken(token);
          if (!live) return;
          if (g) { setKnownGuest({ id: g.id, name: g.name }); slug = slug ?? g.slug; }
        }
        // a signed-in couple landing here with no params previews their own page
        if (!slug && db.wedding.slug) slug = db.wedding.slug;
        if (!slug) { setLoadState("missing"); return; }
        const p = await getPublicInvitation(slug);
        if (!live) return;
        if (!p) { setLoadState("missing"); return; }
        // show dates & money the way the couple set them, not the visitor's defaults
        configureFormat({ locale: p.locale, currency: p.currency, timeZone: p.timezone });
        setPub(p);
        setLoadState("ready");
      } catch {
        if (live) setLoadState("missing");
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token]);

  const cfg: InvitationConfig = pub
    ? {
        templateId: pub.invitation.template_id,
        names: pub.names,
        line1: pub.invitation.line1,
        line2: pub.invitation.line2,
        venueLine: pub.invitation.venue_line,
        rsvp: pub.invitation.collect_rsvp,
        meal: pub.invitation.collect_meal,
        notes: pub.invitation.collect_notes,
        photo: pub.invitation.photo,
        colors: pub.invitation.colors,
        fontSerif: pub.invitation.font_serif,
        motion: pub.invitation.motion,
        music: pub.invitation.music,
      }
    : db.invitation;
  const custom: PublicCustom = pub ? pub.custom : db.customTemplates.find((c) => c.id === cfg.templateId) ?? null;
  const names = pub ? pub.names : db.wedding.names;
  const dateIso = pub ? pub.date : db.wedding.date;
  const plan = pub ? pub.plan : db.plan;
  const website = pub
    ? { ...pub.website, heroPhoto: pub.website.hero_photo }
    : db.website;
  /** minimal Db-shaped object so SiteBody can render the public record */
  const siteDb: Db = pub
    ? {
        ...db,
        wedding: { ...db.wedding, names: pub.names, partnerA: pub.partnerA, partnerB: pub.partnerB, date: pub.date, venue: pub.venue, location: pub.location },
        registry: pub.registry.map((r, i) => ({ id: `pr-${i}`, name: r.name, store: r.store, price: 0, url: "#", purchased: false })),
      }
    : db;

  const template = seedTemplates.find((t) => t.id === cfg.templateId) ?? seedTemplates[0];
  const colors = cfg.colors ?? { bg: template.bg, ink: template.ink, accent: template.accent };
  const serif = cfg.fontSerif ?? template.serif;
  const fontFamily = serif ? "'Playfair Display', Georgia, serif" : "'Nunito Sans', sans-serif";
  const luxe = plan === "luxe";
  const motionCfg = cfg.motion;
  const petalsOn = luxe && motionCfg.petals !== "off" && !reduced;
  const petalCount = motionCfg.petals === "lush" ? 14 : 7;

  const countdown = useCountdown(new Date(dateIso).getTime());

  const musicCfg = cfg.music;
  const hasUpload = musicCfg.track === "upload" && !!musicCfg.uploadData;
  const { playing, start, stop } = useChimeLoop(musicCfg.track === "upload" ? "serene" : musicCfg.track);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const rsvpRef = React.useRef<HTMLElement | null>(null);
  const [uploadPlaying, setUploadPlaying] = useState(false);

  const toggleMusic = () => {
    if (hasUpload && audioRef.current) {
      if (uploadPlaying) { audioRef.current.pause(); setUploadPlaying(false); }
      else { audioRef.current.currentTime = 0; void audioRef.current.play().catch(() => {}); setUploadPlaying(true); }
      return;
    }
    if (playing) stop(); else start();
  };

  /* ------------------------------ rsvp form ------------------------------ */
  const [name, setName] = useState("");
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [meal, setMeal] = useState(MEALS[0]);
  const [note, setNote] = useState("");
  const [plusOne, setPlusOne] = useState("");
  const [plusOneMeal, setPlusOneMeal] = useState<string | null>(null);
  const [done, setDone] = useState<null | "yes" | "no">(null);
  const [sending, setSending] = useState(false);

  // personal links pre-fill the invited guest's name
  useEffect(() => { if (knownGuest) setName(knownGuest.name); }, [knownGuest]);

  const suggestions = useMemo(
    () => (pub ? (knownGuest ? [knownGuest.name] : []) : db.guests.map((g) => g.name)),
    [pub, knownGuest, db.guests],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast("Who's answering?", "Pop your name in so we know who to save a seat for.", "warn"); return; }
    if (!answer) { toast("One more tap", "Joyfully accept or regretfully decline — either way, we'll know.", "warn"); return; }

    const po = answer === "yes" && plusOne.trim() ? plusOne.trim() : null;
    const poMeal = po ? (plusOneMeal ?? meal) : null;

    if (pub) {
      // real submission — the anonymous insert policy verifies token/slug.
      // The guest list is NEVER mutated from here; the couple reviews and syncs.
      setSending(true);
      try {
        await submitRsvp({ token, slug: pub.slug, name: name.trim(), answer, meal: answer === "yes" ? meal : null, note: note.trim() || null, source, plusOne: po, plusOneMeal: poMeal });
        playChime(answer === "yes" ? "sparkle" : "undo");
        setDone(answer);
      } catch {
        toast("Couldn't send your RSVP", "Check your connection and try again — nothing was lost.", "warn");
      } finally {
        setSending(false);
      }
      return;
    }

    // demo playground — local only, and even here answers wait in the RSVP
    // tracker for the couple's review step, so the flow is honest everywhere
    const entry = { id: `rv-${Date.now()}`, name: name.trim(), answer, meal: answer === "yes" ? meal : null, note: note.trim(), at: Date.now(), source, plusOne: po, plusOneMeal: poMeal };
    patch({ rsvpLog: [entry, ...db.rsvpLog] });
    playChime(answer === "yes" ? "sparkle" : "undo");
    setDone(answer);
  };

  const link = pub ? inviteLink(pub.slug) : inviteLink(db.wedding.names);

  if (mode === "cloud" && loadState === "loading") return <PageSkeleton />;
  if (mode === "cloud" && loadState === "missing") return <MissingInvite />;

  return (
    <div className="relative min-h-[100svh] overflow-hidden" style={{ background: colors.bg, color: colors.ink, fontFamily }}>
      {/* ambient atmosphere */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{
        background: `radial-gradient(48% 38% at 18% 12%, ${colors.accent}22, transparent 70%), radial-gradient(42% 36% at 84% 28%, #FFB5C22E, transparent 70%), radial-gradient(46% 40% at 50% 96%, #A8C5A026, transparent 70%)`,
      }} />
      {petalsOn && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {Array.from({ length: petalCount }).map((_, i) => (
            <span key={i} className="inv-petal" style={{ left: `${(i * 83) % 100}%`, animationDuration: `${8 + (i % 5) * 2.1}s`, animationDelay: `${i * 1.15}s` }} />
          ))}
        </div>
      )}

      {/* top bar */}
      <div className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" aria-label="Back to Luma home"><Logo /></Link>
        <button
          onClick={toggleMusic}
          aria-label={playing || uploadPlaying ? "Stop music" : "Play music"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[0.74rem] font-bold transition cursor-pointer ${playing || uploadPlaying ? "" : "opacity-80 hover:opacity-100"}`}
          style={{ borderColor: `${colors.accent}66`, background: playing || uploadPlaying ? colors.accent : `${colors.accent}14`, color: playing || uploadPlaying ? colors.bg : colors.ink }}
        >
          {playing || uploadPlaying ? <StopCircle size={13} /> : <Play size={13} />}
          {playing || uploadPlaying ? "Playing" : hasUpload ? musicCfg.uploadName : "Music"}
        </button>
      </div>
      {hasUpload && <audio ref={audioRef} src={musicCfg.uploadData ?? undefined} loop onEnded={() => setUploadPlaying(false)} className="hidden" />}

      <main className="relative z-10 mx-auto max-w-3xl px-5 pb-20">
        {/* the invitation itself */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[1.6rem] shadow-glass"
          style={{ border: `1px solid ${colors.accent}44` }}
        >
          {custom ? (
            custom.html ? (
              <div>
                <DesignFrame html={custom.html} title={`${custom.name} — the invitation`} className="h-[74vh] min-h-[500px] bg-white" />
                <div className="px-7 py-5 text-center sm:px-10">
                  <p className="text-[0.78rem] font-bold tracking-wide opacity-75">
                    A live invitation — explore it above, then answer below when you're ready.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <SafeImg src={custom.dataUrl ?? ""} alt={`${custom.name} — wedding invitation`} className="w-full" />
                <div className="px-7 py-8 text-center sm:px-10">
                  <p className="font-display text-xl italic" style={{ color: colors.accent }}>{fmtDate(dateIso, { month: "long", day: "numeric", year: "numeric" })}</p>
                  <p className="mt-1.5 text-[0.88rem] font-semibold opacity-80">{cfg.venueLine}</p>
                </div>
              </div>
            )
          ) : (
            <InviteArt template={template} colors={colors} serif={serif} cfg={cfg} animated={luxe && !reduced} dateIso={dateIso} />
          )}

          {/* countdown */}
          <div className="border-t px-6 py-7" style={{ borderColor: `${colors.accent}33`, background: `${colors.accent}0A` }}>
            <p className="text-center text-[0.6rem] font-extrabold uppercase tracking-[0.35em]" style={{ color: colors.accent }}>Counting down to forever</p>
            <div className="mt-4 flex justify-center gap-2.5 sm:gap-4" aria-label="Countdown to the wedding">
              {[["days", countdown.d], ["hours", countdown.h], ["min", countdown.m], ["sec", countdown.s]].map(([label, v]) => (
                <div key={label as string} className="w-16 rounded-2xl border px-2 py-3 text-center sm:w-[4.6rem]" style={{ borderColor: `${colors.accent}55`, background: colors.bg }}>
                  <p className={`font-display text-2xl tabular-nums sm:text-[1.7rem] ${luxe && motionCfg.shimmer ? "shimmer-text" : ""}`}>{String(v).padStart(2, "0")}</p>
                  <p className="text-[0.56rem] font-extrabold uppercase tracking-[0.18em] opacity-55">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* RSVP */}
        {cfg.rsvp && (
        <motion.section
          ref={rsvpRef}
          initial={reduced ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.8 }}
          className="mt-8 scroll-mt-6 rounded-[1.6rem] p-7 text-center sm:p-9"
          style={{ border: `1px solid ${colors.accent}44`, background: `${colors.accent}0D` }}
          aria-label="RSVP"
        >
          <AnimatePresence mode="wait">
            {done === null ? (
              <motion.form key="form" onSubmit={submit} exit={{ opacity: 0, y: -16 }} className="text-left">
                <p className="text-center text-[0.62rem] font-extrabold uppercase tracking-[0.32em]" style={{ color: colors.accent }}>Kindly reply</p>
                <h1 className="mt-2 text-center font-display text-[1.8rem] leading-tight sm:text-3xl">Will you join us?</h1>
                {knownGuest && (
                  <p className="mt-2 text-center text-[0.8rem] font-semibold opacity-70">
                    Answering as <span className="font-extrabold" style={{ color: colors.accent }}>{knownGuest.name}</span>
                  </p>
                )}

                <label className="mt-6 block">
                  <span className="mb-1.5 block text-[0.7rem] font-extrabold uppercase tracking-[0.16em] opacity-60">Your name</span>
                  <input
                    list="guest-names" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="As it appears on the invitation"
                    className="w-full rounded-xl border bg-transparent px-4 py-3 text-[0.95rem] placeholder:opacity-40 focus:outline-none focus:ring-2"
                    style={{ borderColor: `${colors.accent}55` }}
                  />
                  <datalist id="guest-names">
                    {suggestions.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </label>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {([["yes", "Joyfully accept"], ["no", "Regretfully decline"]] as const).map(([v, label]) => (
                    <button
                      key={v} type="button" onClick={() => setAnswer(v)} aria-pressed={answer === v}
                      className={`rounded-xl border px-4 py-3.5 text-[0.85rem] font-bold transition-all duration-300 cursor-pointer ${answer === v ? "scale-[1.02] shadow-card" : "opacity-65 hover:opacity-100"}`}
                      style={answer === v ? { background: colors.ink, color: colors.bg, borderColor: colors.ink } : { borderColor: `${colors.accent}55` }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {cfg.meal && answer === "yes" && (
                  <motion.div initial={reduced ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                    <p className="mb-1.5 mt-4 text-[0.7rem] font-extrabold uppercase tracking-[0.16em] opacity-60">Your meal</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MEALS.map((m) => (
                        <button key={m} type="button" onClick={() => setMeal(m)} aria-pressed={meal === m}
                          className={`rounded-full border px-3.5 py-1.5 text-[0.76rem] font-bold transition cursor-pointer ${meal === m ? "" : "opacity-55 hover:opacity-90"}`}
                          style={meal === m ? { background: colors.accent, color: colors.bg, borderColor: colors.accent } : { borderColor: `${colors.accent}55` }}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {answer === "yes" && (
                  <motion.div initial={reduced ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                    <label className="mt-4 block">
                      <span className="mb-1.5 block text-[0.7rem] font-extrabold uppercase tracking-[0.16em] opacity-60">Bringing a plus-one? <span className="normal-case opacity-70">(their name)</span></span>
                      <input
                        value={plusOne} onChange={(e) => setPlusOne(e.target.value)}
                        placeholder="Leave blank if it's just you"
                        className="w-full rounded-xl border bg-transparent px-4 py-3 text-[0.95rem] placeholder:opacity-40 focus:outline-none focus:ring-2"
                        style={{ borderColor: `${colors.accent}55` }}
                      />
                    </label>
                    {plusOne.trim() && cfg.meal && (
                      <div className="mt-3">
                        <p className="mb-1.5 text-[0.7rem] font-extrabold uppercase tracking-[0.16em] opacity-60">{plusOne.trim().split(" ")[0]}'s meal</p>
                        <div className="flex flex-wrap gap-1.5">
                          {MEALS.map((m) => (
                            <button key={m} type="button" onClick={() => setPlusOneMeal(m)} aria-pressed={plusOneMeal === m}
                              className={`rounded-full border px-3.5 py-1.5 text-[0.76rem] font-bold transition cursor-pointer ${plusOneMeal === m ? "" : "opacity-55 hover:opacity-90"}`}
                              style={plusOneMeal === m ? { background: colors.ink, color: colors.bg, borderColor: colors.ink } : { borderColor: `${colors.accent}55` }}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {cfg.notes && (
                  <label className="mt-4 block">
                    <span className="mb-1.5 block text-[0.7rem] font-extrabold uppercase tracking-[0.16em] opacity-60">A note for the couple</span>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Songs you'll dance to, allergies, excitement…"
                      className="w-full rounded-xl border bg-transparent px-4 py-3 text-[0.9rem] placeholder:opacity-40 focus:outline-none focus:ring-2"
                      style={{ borderColor: `${colors.accent}55` }} />
                  </label>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  aria-busy={sending}
                  className="mt-6 w-full rounded-full py-3.5 text-[0.92rem] font-extrabold transition-all duration-300 hover:brightness-110 active:scale-[0.98] cursor-pointer disabled:cursor-wait disabled:opacity-70 disabled:hover:brightness-100"
                  style={{ background: colors.ink, color: colors.bg }}
                >
                  {sending ? (
                    <>
                      <Loader2 size={15} className="mr-1.5 inline animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      Send my answer <Heart size={13} className="ml-1 inline" fill="currentColor" />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 240, damping: 20 }} className="py-6 text-center">
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 13 }}
                  className="inline-flex h-16 w-16 items-center justify-center rounded-full"
                  style={{ background: `${colors.accent}22` }}
                >
                  {done === "yes" ? <Heart size={30} style={{ color: colors.accent }} fill={colors.accent} /> : <Check size={28} style={{ color: colors.accent }} strokeWidth={2.6} />}
                </motion.span>
                <h2 className="mt-4 font-display text-3xl">{done === "yes" ? "You're on the list!" : "You'll be missed"}</h2>
                <p className="mx-auto mt-2 max-w-sm text-[0.9rem] leading-relaxed opacity-75">
                  {done === "yes"
                    ? `${name.split(" ")[0]}, we're saving you a seat${plusOne.trim() ? ` — and one for ${plusOne.trim().split(" ")[0]}` : ""}${cfg.meal ? ` (${meal} noted)` : ""}. ${names.split("&")[0]?.trim()} will be over the moon.`
                    : "Thank you for letting us know — we'll raise a glass in your honour."}
                </p>
                <button onClick={() => { setDone(null); setAnswer(null); setNote(""); setPlusOne(""); setPlusOneMeal(null); }} className="mt-5 text-[0.78rem] font-bold underline-offset-4 hover:underline cursor-pointer" style={{ color: colors.accent }}>
                  Change my answer
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
        )}

        {/* the rest of the story — the wedding website, living on this same page */}
        {website.published && (
          <motion.section
            initial={reduced ? false : { opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 overflow-hidden rounded-[1.6rem] shadow-lift"
            style={{ border: `1px solid ${colors.accent}44` }}
            aria-label="Wedding details"
          >
            <SiteBody
              w={{ ...website, sections: { ...website.sections, hero: false, rsvp: false } }}
              db={siteDb}
              anim={luxe && website.animations && !reduced}
              footer={false}
              onRsvp={() => rsvpRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" })}
            />
          </motion.section>
        )}

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-[0.66rem] font-bold uppercase tracking-[0.3em] opacity-45">
          <Sparkles size={11} /> Made with Luma · {link.replace("https://", "")}
        </p>
      </main>
    </div>
  );
}
